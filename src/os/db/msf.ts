import { getDb, log } from './workspace';
import { TEXT_PARSERS } from './sql';

/**
 * Metasploit-style workspace helpers used by msfconsole and nmap.
 * The current workspace is per-tab (like msfconsole's own session state).
 */

let current = 'portfolio';

export function currentWorkspace(): string {
  return current;
}

export async function workspaceId(name = current): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ id: number }>('select id from workspaces where name = $1', [name]);
  if (r.rows[0]) return r.rows[0].id;
  const ins = await db.query<{ id: number }>(
    `insert into workspaces (name) values ($1) on conflict (name) do update set name = excluded.name returning id`,
    [name],
  );
  return ins.rows[0].id;
}

export async function listWorkspaces(): Promise<string[]> {
  const db = await getDb();
  const r = await db.query<{ name: string }>('select name from workspaces order by id');
  return r.rows.map((x) => x.name);
}

export async function addWorkspace(name: string): Promise<void> {
  await workspaceId(name);
  current = name;
  log('msf.workspace.add', { name });
}

export async function switchWorkspace(name: string): Promise<boolean> {
  const all = await listWorkspaces();
  if (!all.includes(name)) return false;
  current = name;
  return true;
}

export async function deleteWorkspace(name: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.query('delete from workspaces where name = $1', [name]);
  if (current === name) current = 'portfolio';
  return (r.affectedRows ?? 0) > 0;
}

export interface HostInput {
  address: string;
  name?: string | null;
  os_name?: string | null;
  os_flavor?: string | null;
  comments?: string | null;
}

export interface ServiceInput {
  port: number;
  proto?: string;
  name?: string | null;
  info?: string | null;
  state?: string;
}

/** Upsert one host (+ services) into the current workspace. Returns the host id. */
export async function upsertHost(host: HostInput, services: ServiceInput[] = [], ws = current): Promise<number> {
  const db = await getDb();
  const wid = await workspaceId(ws);
  const r = await db.query<{ id: number }>(
    `insert into hosts (workspace_id, address, name, os_name, os_flavor, comments)
     values ($1, $2::inet, $3, $4, $5, $6)
     on conflict (workspace_id, address) do update set
       name = coalesce(excluded.name, hosts.name),
       os_name = coalesce(excluded.os_name, hosts.os_name),
       os_flavor = coalesce(excluded.os_flavor, hosts.os_flavor),
       comments = coalesce(excluded.comments, hosts.comments),
       state = 'alive'
     returning id`,
    [wid, host.address, host.name ?? null, host.os_name ?? null, host.os_flavor ?? null, host.comments ?? null],
  );
  const id = r.rows[0].id;
  for (const s of services) {
    await db.query(
      `insert into services (host_id, port, proto, state, name, info) values ($1, $2, $3, $4, $5, $6)
       on conflict (host_id, port, proto) do update set state = excluded.state,
         name = coalesce(excluded.name, services.name), info = coalesce(nullif(excluded.info, ''), services.info)`,
      [id, s.port, s.proto ?? 'tcp', s.state ?? 'open', s.name ?? null, s.info ?? null],
    );
  }
  return id;
}

/** Record a (simulated) nmap result: host + open services + an events row. */
export async function recordScan(
  target: string,
  address: string,
  services: ServiceInput[],
  extra: { os_name?: string; source: string; flags?: string },
): Promise<number> {
  const id = await upsertHost(
    {
      address,
      name: target === address ? null : target,
      os_name: extra.os_name ?? null,
      comments: 'SIMULATED scan result (no packets were sent)',
    },
    services,
  );
  log('nmap.scan', { target, address, ports: services.map((s) => `${s.port}/${s.proto ?? 'tcp'}`), source: extra.source, flags: extra.flags ?? '' });
  return id;
}

export interface HostRow {
  address: string;
  name: string | null;
  os_name: string | null;
  os_flavor: string | null;
  state: string;
  comments: string | null;
  svcs: number;
}

export async function hostsInWorkspace(ws = current): Promise<HostRow[]> {
  const db = await getDb();
  const r = await db.query<HostRow>(
    `select host(h.address) as address, h.name, h.os_name, h.os_flavor, h.state, h.comments,
       (select count(*)::int from services s where s.host_id = h.id) as svcs
     from hosts h join workspaces w on w.id = h.workspace_id
     where w.name = $1 order by h.address`,
    [ws],
  );
  return r.rows;
}

export interface ServiceRow {
  host: string;
  port: number;
  proto: string;
  name: string | null;
  state: string;
  info: string | null;
}

export async function servicesInWorkspace(ws = current): Promise<ServiceRow[]> {
  const db = await getDb();
  const r = await db.query<ServiceRow>(
    `select host(h.address) as host, s.port, s.proto, s.name, s.state, s.info
     from services s join hosts h on h.id = s.host_id join workspaces w on w.id = h.workspace_id
     where w.name = $1 order by h.address, s.port`,
    [ws],
  );
  return r.rows;
}

export interface NoteRow {
  created_at: string;
  host: string | null;
  ntype: string;
  data: unknown;
}

export async function notesInWorkspace(ws = current): Promise<NoteRow[]> {
  const db = await getDb();
  const r = await db.query<NoteRow>(
    `select n.created_at, host(h.address) as host, n.ntype, n.data
     from notes n left join hosts h on h.id = n.host_id left join workspaces w on w.id = h.workspace_id
     where w.name = $1 or n.host_id is null order by n.created_at`,
    [ws],
    { parsers: TEXT_PARSERS },
  );
  return r.rows;
}

/** msfconsole-style fixed-width table. */
export function msfTable(title: string, cols: string[], rows: (string | number | null | undefined)[][]): string {
  const cells = rows.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))));
  const widths = cols.map((c, i) => Math.max(c.length, ...cells.map((r) => r[i].length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();
  return [
    title,
    '='.repeat(title.length),
    '',
    line(cols),
    line(widths.map((w) => '-'.repeat(w))),
    ...cells.map(line),
  ].join('\n');
}
