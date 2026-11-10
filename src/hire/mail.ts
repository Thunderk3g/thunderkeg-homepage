import nodemailer from 'nodemailer';
import { briefSubject, briefText, profile, type Brief } from '@/data/resume';

/**
 * Server-side delivery of a "Work with me" brief over SMTP.
 *
 * Configured entirely by environment (see .env.local.example). With Gmail the
 * only two values needed are SMTP_USER (the sending Gmail address) and
 * SMTP_PASS (a 16-character app password, not the account password). The
 * brief lands in HIRE_TO, with Reply-To set to the visitor so a reply goes
 * straight back to them.
 */

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  to: string;
  from: string;
}

export function mailConfig(): MailConfig | null {
  const user = process.env.SMTP_USER?.trim();
  // Gmail shows app passwords in groups of four; the spaces are not part of it
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  return {
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    user,
    pass,
    to: process.env.HIRE_TO?.trim() || profile.email,
    from: process.env.HIRE_FROM?.trim() || user,
  };
}

export const isMailConfigured = () => mailConfig() !== null;

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export async function sendBrief(b: Brief, meta: { origin?: string } = {}): Promise<void> {
  const cfg = mailConfig();
  if (!cfg) throw new Error('mail is not configured');
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    // local test sinks have no certificate; real providers always do
    ...(process.env.SMTP_INSECURE === '1' ? { ignoreTLS: true } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const who = oneLine(b.name) || 'Someone';
  await transport.sendMail({
    from: { name: `${who} via portfolio`, address: cfg.from },
    to: cfg.to,
    replyTo: { name: who, address: b.email },
    subject: oneLine(`[Work with me] ${briefSubject(b)}`).slice(0, 200),
    text: [briefText(b), '', '—', `Reply to: ${b.email}`, meta.origin ? `Sent from: ${meta.origin}` : '']
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n'),
  });
}
