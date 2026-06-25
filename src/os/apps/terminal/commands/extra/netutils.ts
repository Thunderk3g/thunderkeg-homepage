'use client';

import type { Command } from '../../../../types';

/* ────────────────────────── helpers ────────────────────────── */

/** Deterministic-ish hash so the same host yields stable fake IPs. */
function hostHash(host: string): number {
  let h = 2166136261;
  for (let i = 0; i < host.length; i++) {
    h ^= host.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build a plausible public IPv4 from a host name (stable per host). */
function fakeIp(host: string): string {
  const h = hostHash(host);
  const a = 20 + (h & 0x3f); // 20..83
  const b = (h >> 6) & 0xff;
  const c = (h >> 14) & 0xff;
  const d = 1 + ((h >> 22) % 254);
  return `${a}.${b}.${c}.${d}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUrl(raw: string): { scheme: string; host: string; path: string } {
  const m = /^(?:(https?):\/\/)?([^/]+)(\/.*)?$/i.exec(raw.trim());
  const scheme = m?.[1]?.toLowerCase() ?? 'http';
  const host = m?.[2] ?? raw;
  const path = m?.[3] ?? '/';
  return { scheme, host, path };
}

function httpDate(): string {
  return new Date().toUTCString();
}

/* ────────────────────────── commands ────────────────────────── */

export const netutilsCommands: Command[] = [
  {
    name: 'curl',
    summary: 'transfer a URL (simulated GET)',
    usage: 'curl [-I] [-v] <url>',
    category: 'network',
    run: ({ args }) => {
      const url = args.find((a) => !a.startsWith('-'));
      if (!url) return 'curl: try \'curl --help\' for more information';
      const { scheme, host, path } = parseUrl(url);
      const headOnly = args.includes('-I') || args.includes('--head');
      const verbose = args.includes('-v') || args.includes('--verbose');
      const ip = fakeIp(host);
      const out: string[] = [];
      if (verbose) {
        out.push(`*   Trying ${ip}:${scheme === 'https' ? 443 : 80}...`);
        out.push(`* Connected to ${host} (${ip}) port ${scheme === 'https' ? 443 : 80}`);
        if (scheme === 'https') out.push('* TLS 1.3 / TLS_AES_256_GCM_SHA384 (simulated)');
        out.push(`> GET ${path} HTTP/2`, `> Host: ${host}`, '> User-Agent: curl/8.5.0', '>');
      }
      const headers = [
        'HTTP/2 200',
        'server: nginx/1.25.3',
        `date: ${httpDate()}`,
        'content-type: text/html; charset=UTF-8',
        `content-length: ${randInt(420, 8800)}`,
        'cache-control: max-age=600',
        `x-served-by: ${host}`,
      ];
      out.push(...(verbose ? headers.map((h) => `< ${h}`) : headers));
      if (headOnly) return out.join('\n');
      out.push(
        '',
        '<!DOCTYPE html>',
        `<html><head><title>${host}</title></head>`,
        '<body>',
        `  <h1>Welcome to ${host}</h1>`,
        '  <p>It works! This is a simulated response.</p>',
        '</body></html>',
      );
      return out.join('\n');
    },
  },
  {
    name: 'wget',
    summary: 'download a file (simulated progress)',
    usage: 'wget <url>',
    category: 'network',
    run: async ({ args, print }) => {
      const url = args.find((a) => !a.startsWith('-'));
      if (!url) return 'wget: missing URL';
      const { host, path } = parseUrl(url);
      const ip = fakeIp(host);
      const file = path.split('/').filter(Boolean).pop() || 'index.html';
      const total = randInt(180, 4096); // KB
      print(`--${new Date().toISOString().slice(0, 19).replace('T', ' ')}--  ${url}`);
      print(`Resolving ${host}... ${ip}`);
      print(`Connecting to ${host} (${ip})|:443... connected.`);
      print('HTTP request sent, awaiting response... 200 OK');
      print(`Length: ${total * 1024} (${total}K) [application/octet-stream]`);
      print(`Saving to: '${file}'`);
      print('');
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const pct = Math.round((i / steps) * 100);
        const done = Math.round((i / steps) * total);
        const bars = Math.round((i / steps) * 30);
        const bar = '='.repeat(bars) + (i < steps ? '>' : '') + ' '.repeat(30 - bars);
        const speed = randInt(2, 18);
        print(`${file}  ${pct.toString().padStart(3)}% [${bar}] ${done}K  ${speed}.${randInt(0, 9)}MB/s`);
        await sleep(70);
      }
      print('');
      return `'${file}' saved [${total * 1024}/${total * 1024}]`;
    },
  },
  {
    name: 'netstat',
    summary: 'network connections, routing tables (simulated)',
    usage: 'netstat [-tunlp]',
    category: 'network',
    run: () =>
      [
        'Active Internet connections (servers and established)',
        'Proto Recv-Q Send-Q Local Address          Foreign Address        State        PID/Program',
        'tcp        0      0 127.0.0.1:631          0.0.0.0:*              LISTEN       -',
        'tcp        0      0 192.168.1.42:22        0.0.0.0:*              LISTEN       742/sshd',
        'tcp        0      0 192.168.1.42:43912     93.184.216.34:443     ESTABLISHED  1188/firefox',
        'tcp        0      0 192.168.1.42:51220     140.82.112.3:443      ESTABLISHED  1188/firefox',
        'tcp6       0      0 :::80                  :::*                  LISTEN       901/nginx',
        'udp        0      0 192.168.1.42:68        0.0.0.0:*                          512/dhclient',
      ].join('\n'),
  },
  {
    name: 'ss',
    summary: 'socket statistics (simulated)',
    usage: 'ss [-tunlp]',
    category: 'network',
    run: () => {
      const out = [
        'Netid State   Recv-Q Send-Q   Local Address:Port    Peer Address:Port  Process',
        'tcp   LISTEN  0      128            0.0.0.0:22           0.0.0.0:*        users:(("sshd",pid=742,fd=3))',
        'tcp   LISTEN  0      511          127.0.0.1:631          0.0.0.0:*        users:(("cupsd",pid=688,fd=7))',
        'tcp   ESTAB   0      0         192.168.1.42:43912   93.184.216.34:443    users:(("firefox",pid=1188,fd=58))',
        'tcp   ESTAB   0      0         192.168.1.42:51220   140.82.112.3:443     users:(("firefox",pid=1188,fd=61))',
        'tcp   LISTEN  0      511               [::]:80              [::]:*        users:(("nginx",pid=901,fd=6))',
      ];
      return out.join('\n');
    },
  },
  {
    name: 'dig',
    summary: 'DNS lookup utility (simulated)',
    usage: 'dig <domain> [type]',
    category: 'network',
    run: ({ args }) => {
      const domain = args.find((a) => !a.startsWith('-') && !/^(A|AAAA|MX|TXT|NS|CNAME)$/i.test(a)) ?? 'kali.org';
      const type = (args.find((a) => /^(A|AAAA|MX|TXT|NS|CNAME)$/i.test(a)) ?? 'A').toUpperCase();
      const ip = fakeIp(domain);
      const qms = randInt(8, 64);
      const out: string[] = [
        '; <<>> DiG 9.19.19-1-Debian <<>> ' + domain + (type !== 'A' ? ' ' + type : ''),
        ';; global options: +cmd',
        ';; Got answer:',
        `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ${randInt(1000, 65535)}`,
        ';; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1',
        '',
        ';; QUESTION SECTION:',
        `;${domain}.\t\t\tIN\t${type}`,
        '',
        ';; ANSWER SECTION:',
      ];
      if (type === 'MX') out.push(`${domain}.\t\t300\tIN\tMX\t10 mail.${domain}.`);
      else if (type === 'NS') out.push(`${domain}.\t\t86400\tIN\tNS\tns1.${domain}.`);
      else if (type === 'TXT') out.push(`${domain}.\t\t300\tIN\tTXT\t"v=spf1 include:_spf.${domain} ~all"`);
      else if (type === 'AAAA')
        out.push(`${domain}.\t\t300\tIN\tAAAA\t2606:2800:220:1:248:1893:25c8:1946`);
      else if (type === 'CNAME') out.push(`${domain}.\t\t300\tIN\tCNAME\twww.${domain}.`);
      else out.push(`${domain}.\t\t300\tIN\tA\t${ip}`);
      out.push(
        '',
        `;; Query time: ${qms} msec`,
        ';; SERVER: 192.168.1.1#53(192.168.1.1) (UDP)',
        `;; WHEN: ${httpDate()}`,
        ';; MSG SIZE  rcvd: ' + randInt(56, 120),
      );
      return out.join('\n');
    },
  },
  {
    name: 'nslookup',
    summary: 'query Internet name servers (simulated)',
    usage: 'nslookup <domain>',
    category: 'network',
    run: ({ args }) => {
      const domain = args.find((a) => !a.startsWith('-')) ?? 'kali.org';
      const ip = fakeIp(domain);
      return [
        'Server:\t\t192.168.1.1',
        'Address:\t192.168.1.1#53',
        '',
        'Non-authoritative answer:',
        `Name:\t${domain}`,
        `Address: ${ip}`,
        `Name:\t${domain}`,
        `Address: 2606:2800:220:1:248:1893:25c8:1946`,
      ].join('\n');
    },
  },
  {
    name: 'traceroute',
    summary: 'print the route packets take to a host (simulated)',
    usage: 'traceroute <host>',
    category: 'network',
    run: async ({ args, print }) => {
      const host = args.find((a) => !a.startsWith('-')) ?? 'kali.org';
      const dest = fakeIp(host);
      const hops = randInt(6, 11);
      print(`traceroute to ${host} (${dest}), 30 hops max, 60 byte packets`);
      let lastLatency = randInt(1, 4);
      for (let i = 1; i <= hops; i++) {
        await sleep(60);
        if (i > 2 && Math.random() < 0.12) {
          print(`${i.toString().padStart(2)}  * * *`);
          continue;
        }
        lastLatency += randInt(2, 18);
        const ip = i === hops ? dest : fakeIp(host + ':' + i);
        const name = i === hops ? host : `gw-${i}.isp${(i % 3) + 1}.net`;
        const t = (lastLatency + Math.random()).toFixed(3);
        const t2 = (lastLatency + Math.random()).toFixed(3);
        const t3 = (lastLatency + Math.random()).toFixed(3);
        print(`${i.toString().padStart(2)}  ${name} (${ip})  ${t} ms  ${t2} ms  ${t3} ms`);
      }
    },
  },
  {
    name: 'arp',
    summary: 'manipulate the ARP cache (simulated)',
    usage: 'arp [-a]',
    category: 'network',
    run: () =>
      [
        'Address                  HWtype  HWaddress           Flags Mask            Iface',
        '192.168.1.1              ether   00:1a:2b:3c:4d:5e   C                     eth0',
        '192.168.1.10             ether   08:00:27:11:22:33   C                     eth0',
        '192.168.1.23             ether   ac:de:48:00:11:22   C                     eth0',
        '192.168.1.55             ether   52:54:00:ab:cd:ef   C                     eth0',
      ].join('\n'),
  },
];
