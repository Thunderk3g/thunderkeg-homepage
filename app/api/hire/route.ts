import type { NextRequest } from 'next/server';
import { hire, type Brief } from '@/data/resume';
import { isMailConfigured, sendBrief } from '@/hire/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Work with me → my inbox.
 *
 * GET says whether sending is set up, so the form can offer "Send" or fall
 * back to the visitor's own mail app. POST validates the brief and sends it
 * over SMTP. Nothing is stored: the brief exists only in the email.
 */

const LIMITS = { name: 120, company: 160, budget: 160, timeline: 60, details: 5000, email: 254 };
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/** Best-effort throttle. Serverless instances do not share it; it stops a loop, not a botnet. */
const WINDOW_MS = 60 * 60 * 1000;
const PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return false;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** single-line fields: a pasted newline must not start a new line of the email */
const line = (v: unknown, max: number) => str(v, max).replace(/\s*[\r\n]+\s*/g, ' ');

export function GET() {
  return Response.json({ configured: isMailConfigured() });
}

export async function POST(req: NextRequest) {
  // same contract as /api/chat: "not set up" is a supported state, not a 5xx
  if (!isMailConfigured()) return Response.json({ ok: false, reason: 'unconfigured' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, reason: 'invalid', error: 'Malformed request.' }, { status: 400 });
  }

  // a field no person sees or fills in; a bot that does gets a quiet success
  if (str(body.website, 200)) return Response.json({ ok: true });

  const brief: Brief = {
    engagement: hire.engagements.some((e) => e.id === body.engagement) ? (body.engagement as string) : 'project',
    name: line(body.name, LIMITS.name),
    email: str(body.email, LIMITS.email),
    company: line(body.company, LIMITS.company),
    services: Array.isArray(body.services)
      ? hire.services.filter((s) => (body.services as unknown[]).includes(s.id)).map((s) => s.id)
      : [],
    timeline: line(body.timeline, LIMITS.timeline),
    budget: line(body.budget, LIMITS.budget),
    details: str(body.details, LIMITS.details),
  };

  if (!EMAIL.test(brief.email)) {
    return Response.json({ ok: false, reason: 'invalid', error: 'Add an email address I can reply to.' }, { status: 400 });
  }
  if (brief.details.length < 10) {
    return Response.json({ ok: false, reason: 'invalid', error: 'Add a line or two about what you need.' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (throttled(ip)) {
    return Response.json(
      { ok: false, reason: 'throttled', error: 'Too many briefs from this connection. Email me directly instead.' },
      { status: 429 },
    );
  }

  try {
    await sendBrief(brief, { origin: req.headers.get('origin') ?? undefined });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[hire] send failed:', err instanceof Error ? err.message : err);
    return Response.json({ ok: false, reason: 'failed', error: 'The mail server did not accept it.' }, { status: 502 });
  }
}
