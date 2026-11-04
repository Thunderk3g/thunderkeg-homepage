/**
 * msfdb-style workspace schema (modelled on Metasploit's hosts/services/notes/
 * loot/creds tables) plus two portfolio tables: papers (mirrored from the
 * Research app) and events (an append-only activity log).
 *
 * Every statement is idempotent so it can run on every boot.
 */
export const MIGRATIONS = `
create table if not exists workspaces (
  id          serial primary key,
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists hosts (
  id            serial primary key,
  workspace_id  int not null references workspaces(id) on delete cascade,
  address       inet not null,
  name          text,
  os_name       text,
  os_flavor     text,
  state         text not null default 'alive',
  comments      text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, address)
);

create table if not exists services (
  id       serial primary key,
  host_id  int not null references hosts(id) on delete cascade,
  port     int not null check (port between 0 and 65535),
  proto    text not null default 'tcp',
  state    text not null default 'open',
  name     text,
  info     text,
  unique (host_id, port, proto)
);

create table if not exists notes (
  id          serial primary key,
  host_id     int references hosts(id) on delete cascade,
  ntype       text not null,
  data        jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists loot (
  id            serial primary key,
  host_id       int references hosts(id) on delete cascade,
  ltype         text not null,
  path          text,
  content_type  text,
  name          text,
  info          text,
  created_at    timestamptz not null default now()
);

create table if not exists creds (
  id            serial primary key,
  host_id       int references hosts(id) on delete cascade,
  username      text,
  private_data  text,
  private_type  text,
  created_at    timestamptz not null default now()
);

create table if not exists papers (
  id         text primary key,
  title      text not null,
  authors    text[] not null default '{}',
  published  date,
  status     text,
  tags       text[] not null default '{}',
  abstract   text,
  saved_at   timestamptz
);

create table if not exists events (
  id      bigserial primary key,
  kind    text not null,
  detail  jsonb,
  at      timestamptz not null default now()
);

create index if not exists events_at_idx on events (at desc);
create index if not exists services_host_idx on services (host_id);
`;

/** First-run seed — clearly fake lab hosts on a private range. Runs once. */
export const SEED = `
with ws as (select id from workspaces where name = 'portfolio')
insert into hosts (workspace_id, address, name, os_name, os_flavor, state, comments)
select ws.id, v.address::inet, v.name, v.os_name, v.os_flavor, 'alive', v.comments
from ws, (values
  ('10.10.10.5',  'metasploitable', 'Linux',   'Ubuntu 8.04',        'SIMULATED lab data: Metasploitable 2 training VM, not a real host'),
  ('10.10.10.10', 'dc01',           'Windows', 'Server 2019',        'SIMULATED lab data: fictional domain controller for AD practice'),
  ('10.10.10.20', 'web01',          'Linux',   'Debian 12',          'SIMULATED lab data: fictional nginx box'),
  ('10.10.10.30', 'files01',        'Linux',   'Ubuntu 22.04',       'SIMULATED lab data: fictional Samba share'),
  ('10.10.10.99', 'printer',        'Embedded','HP JetDirect',       'SIMULATED lab data: the obligatory forgotten printer')
) as v(address, name, os_name, os_flavor, comments)
on conflict (workspace_id, address) do nothing;

insert into services (host_id, port, proto, state, name, info)
select h.id, v.port, v.proto, 'open', v.name, v.info
from hosts h
join (values
  ('10.10.10.5', 21,   'tcp', 'ftp',          'vsftpd 2.3.4'),
  ('10.10.10.5', 22,   'tcp', 'ssh',          'OpenSSH 4.7p1 Debian 8ubuntu1'),
  ('10.10.10.5', 23,   'tcp', 'telnet',       'Linux telnetd'),
  ('10.10.10.5', 80,   'tcp', 'http',         'Apache httpd 2.2.8 (Ubuntu) DAV/2'),
  ('10.10.10.5', 139,  'tcp', 'netbios-ssn',  'Samba smbd 3.X - 4.X'),
  ('10.10.10.5', 3306, 'tcp', 'mysql',        'MySQL 5.0.51a-3ubuntu5'),
  ('10.10.10.5', 5432, 'tcp', 'postgresql',   'PostgreSQL DB 8.3.0 - 8.3.7'),
  ('10.10.10.10', 53,  'tcp', 'domain',       'Simple DNS Plus'),
  ('10.10.10.10', 88,  'tcp', 'kerberos-sec', 'Microsoft Windows Kerberos'),
  ('10.10.10.10', 389, 'tcp', 'ldap',         'Microsoft Windows Active Directory LDAP (Domain: lab.local)'),
  ('10.10.10.10', 445, 'tcp', 'microsoft-ds', 'Windows Server 2019 microsoft-ds'),
  ('10.10.10.10', 3389,'tcp', 'ms-wbt-server','Microsoft Terminal Services'),
  ('10.10.10.20', 22,  'tcp', 'ssh',          'OpenSSH 9.2p1 Debian 2'),
  ('10.10.10.20', 80,  'tcp', 'http',         'nginx 1.22.1'),
  ('10.10.10.20', 443, 'tcp', 'https',        'nginx 1.22.1'),
  ('10.10.10.30', 445, 'tcp', 'microsoft-ds', 'Samba smbd 4.15.13-Ubuntu'),
  ('10.10.10.99', 9100,'tcp', 'jetdirect',    'HP JetDirect'),
  ('10.10.10.99', 161, 'udp', 'snmp',         'SNMPv1 server (public)')
) as v(address, port, proto, name, info) on h.address = v.address::inet
on conflict (host_id, port, proto) do nothing;

insert into notes (host_id, ntype, data)
select h.id, v.ntype, v.data::jsonb
from hosts h
join (values
  ('10.10.10.5',  'vuln.candidate', '{"service":"ftp","note":"vsftpd 2.3.4 banner - textbook lab backdoor","simulated":true}'),
  ('10.10.10.10', 'smb.signing',    '{"required":true,"simulated":true}'),
  ('10.10.10.99', 'snmp.community', '{"community":"public","simulated":true}')
) as v(address, ntype, data) on h.address = v.address::inet;

insert into creds (host_id, username, private_data, private_type)
select h.id, v.username, v.private_data, v.private_type
from hosts h
join (values
  ('10.10.10.5',  'msfadmin', 'msfadmin (SIMULATED - documented Metasploitable default)', 'password'),
  ('10.10.10.10', 'lab\\svc_backup', 'not-a-real-secret', 'password')
) as v(address, username, private_data, private_type) on h.address = v.address::inet;

insert into loot (host_id, ltype, path, content_type, name, info)
select h.id, 'host.files', '/etc/passwd', 'text/plain', 'passwd', 'SIMULATED placeholder, no file content stored'
from hosts h where h.address = '10.10.10.5'::inet;
`;
