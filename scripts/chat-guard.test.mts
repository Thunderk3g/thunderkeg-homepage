import assert from 'node:assert/strict';
// Run: npx tsx scripts/chat-guard.test.mts
import { MAX_MESSAGE_CHARS, clientAddress, resetGuard, sameOrigin, withinRate, withinSize } from '../src/os/ai/guard.ts';

const ok = (c: boolean, m: string) => { assert.ok(c, m); console.log('ok -', m); };
const h = (o: Record<string, string>) => new Headers(o);

ok(sameOrigin(h({ host: 'site.example', origin: 'https://site.example', 'sec-fetch-site': 'same-origin' })), 'the site itself may call');
ok(!sameOrigin(h({ host: 'site.example', origin: 'https://evil.example' })), 'another origin may not');
ok(!sameOrigin(h({ host: 'site.example', 'sec-fetch-site': 'cross-site' })), 'a cross-site fetch may not');
ok(sameOrigin(h({ host: 'internal', 'x-forwarded-host': 'site.example', origin: 'https://site.example' })), 'a proxied host still counts as the site');
ok(sameOrigin(h({ host: 'site.example' })), 'a request with no Origin is left to the rate limit');

ok(withinSize([{ content: 'hello' }]), 'an ordinary question fits');
ok(!withinSize([{ content: 'x'.repeat(MAX_MESSAGE_CHARS + 1) }]), 'one oversized message is refused');
ok(!withinSize(Array.from({ length: 3 }, () => ({ content: 'x'.repeat(MAX_MESSAGE_CHARS) }))), 'so is an oversized total');
ok(!withinSize([{ content: 42 }]), 'and content that is not text');

ok(clientAddress(h({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })) === '1.2.3.4', 'the first forwarded address is the client');

resetGuard();
const t0 = 1_000_000;
let allowed = 0;
for (let i = 0; i < 25; i++) if (withinRate('1.2.3.4', t0 + i).ok) allowed++;
ok(allowed === 20, 'one address gets 20 requests in the window');
const blocked = withinRate('1.2.3.4', t0 + 30);
ok(!blocked.ok && blocked.status === 429 && (blocked.retryAfter ?? 0) > 0, 'then a 429 with a retry-after');
ok(withinRate('5.6.7.8', t0 + 30).ok, 'another address is unaffected');
ok(withinRate('1.2.3.4', t0 + 5 * 60_000 + 1).ok, 'and the window slides');

console.log('\nall chat guard checks passed');
