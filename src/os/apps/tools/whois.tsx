'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AppDefinition } from '../../types';

/* whois lookup — educational SIMULATION. All output is canned/derived, no network. */

const REGISTRARS = [
  'NameCheap, Inc.',
  'GoDaddy.com, LLC',
  'Google LLC',
  'Cloudflare, Inc.',
  'Gandi SAS',
  'Amazon Registrar, Inc.',
];

const NS_PROVIDERS = [
  ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
  ['ns-1.awsdns-01.org', 'ns-2.awsdns-02.com'],
  ['dns1.registrar-servers.com', 'dns2.registrar-servers.com'],
  ['ns1.google.com', 'ns2.google.com'],
];

// Deterministic pseudo-hash so the same domain always yields the same record.
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10) + 'T00:00:00Z';
}

function buildRecord(raw: string): string {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const h = seed(domain);
  const registrar = REGISTRARS[h % REGISTRARS.length];
  const ns = NS_PROVIDERS[(h >> 3) % NS_PROVIDERS.length];
  const created = new Date(2004 + (h % 18), h % 12, 1 + (h % 27));
  const updated = new Date(2023, (h >> 4) % 12, 1 + ((h >> 2) % 27));
  const expires = new Date(created.getFullYear() + 21, created.getMonth(), created.getDate());
  const ianaId = 1000 + (h % 9000);

  return [
    `   Domain Name: ${domain.toUpperCase()}`,
    `   Registry Domain ID: ${h.toString(16).toUpperCase()}_DOMAIN-SIM`,
    `   Registrar WHOIS Server: whois.${registrar.split(/[ ,.]/)[0].toLowerCase()}.com`,
    `   Registrar URL: http://www.${registrar.split(/[ ,.]/)[0].toLowerCase()}.com`,
    `   Updated Date: ${fmtDate(updated)}`,
    `   Creation Date: ${fmtDate(created)}`,
    `   Registry Expiry Date: ${fmtDate(expires)}`,
    `   Registrar: ${registrar}`,
    `   Registrar IANA ID: ${ianaId}`,
    `   Registrar Abuse Contact Email: abuse@${registrar.split(/[ ,.]/)[0].toLowerCase()}.com`,
    `   Registrar Abuse Contact Phone: +1.${4000000000 + (h % 999999999)}`,
    `   Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited`,
    `   Name Server: ${ns[0].toUpperCase()}`,
    `   Name Server: ${ns[1].toUpperCase()}`,
    `   DNSSEC: ${h % 2 === 0 ? 'signedDelegation' : 'unsigned'}`,
    '',
    '>>> Last update of WHOIS database: ' + fmtDate(new Date()) + ' <<<',
    '',
    '   (simulated record — registrant data redacted for privacy)',
    '   Registrant Organization: REDACTED FOR PRIVACY',
    '   Registrant State/Province: ' + ['CA', 'WA', 'TX', 'NY'][h % 4],
    '   Registrant Country: US',
  ].join('\n');
}

const VALID = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#0b0f14',
  color: '#c7d5e0',
  fontFamily: 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
  fontSize: 13,
};

const bar: CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '10px 12px',
  borderBottom: '1px solid #1d2733',
  background: '#10161e',
  alignItems: 'center',
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '7px 10px',
  background: '#0b0f14',
  border: '1px solid #2a3a4a',
  borderRadius: 4,
  color: '#e6edf3',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
};

const btn: CSSProperties = {
  padding: '7px 16px',
  background: '#367c2b',
  border: '1px solid #4a9c3c',
  borderRadius: 4,
  color: '#eaffea',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'inherit',
};

const out: CSSProperties = {
  flex: 1,
  margin: 0,
  padding: 14,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  lineHeight: 1.45,
};

function Whois() {
  const [domain, setDomain] = useState('example.com');
  const [record, setRecord] = useState('');
  const [error, setError] = useState('');

  const lookup = useCallback(() => {
    const d = domain.trim();
    if (!d) {
      setError('Enter a domain name to look up.');
      setRecord('');
      return;
    }
    const bare = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!VALID.test(bare)) {
      setError(`Invalid domain: "${d}" — try something like example.com`);
      setRecord('');
      return;
    }
    setError('');
    setRecord(`Querying whois.iana.org for ${bare} ... (simulation)\n\n` + buildRecord(bare));
  }, [domain]);

  return (
    <div style={wrap}>
      <div style={bar}>
        <span style={{ color: '#6fb3ff', whiteSpace: 'nowrap' }}>whois ▸</span>
        <input
          style={inputStyle}
          value={domain}
          spellCheck={false}
          placeholder="domain.tld"
          aria-label="domain"
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') lookup();
          }}
        />
        <button type="button" style={btn} onClick={lookup}>
          Lookup
        </button>
      </div>
      {error ? (
        <pre style={{ ...out, color: '#ff8a8a' }}>{error}</pre>
      ) : record ? (
        <pre style={out}>{record}</pre>
      ) : (
        <pre style={{ ...out, color: '#7a8a99' }}>
          {'WHOIS client (simulation)\n\nEnter a domain above and press Lookup to retrieve a\ncanned registration record. No real network query is made.'}
        </pre>
      )}
    </div>
  );
}

export const whoisApp: AppDefinition = {
  id: 'whois',
  title: 'whois',
  icon: '🔎',
  category: 'Information Gathering',
  component: Whois,
  description: 'Domain registration lookup (simulation)',
  defaultSize: { width: 640, height: 440 },
  minSize: { width: 380, height: 260 },
  launchCommands: ['whois'],
};

export default Whois;
