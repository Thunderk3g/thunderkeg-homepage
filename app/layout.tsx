import type { Metadata, Viewport } from 'next';
import { Ubuntu, Ubuntu_Mono } from 'next/font/google';
import './globals.css';

const ubuntu = Ubuntu({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-ubuntu',
  display: 'swap',
});

const ubuntuMono = Ubuntu_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Diwakar Adhikari — Kali Linux Portfolio',
  description:
    'AI/ML Lead Engineer. My portfolio rendered as a fully interactive Kali Linux desktop — terminal, security tools, and a multiplayer games arcade. Plain résumé at /resume.',
  authors: [{ name: 'Diwakar Adhikari', url: 'https://github.com/Thunderk3g' }],
  openGraph: {
    type: 'website',
    title: 'Diwakar Adhikari — Technical Lead, AI Engineering',
    description:
      'Retrieval-grounded and speech AI, built where a wrong answer is a regulatory event. A portfolio you can boot: terminal, writing, research and an arcade.',
  },
  twitter: {
    card: 'summary',
    title: 'Diwakar Adhikari — Technical Lead, AI Engineering',
    description: 'Retrieval-grounded and speech AI. A portfolio rendered as a Kali Linux desktop.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0e14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ubuntu.variable} ${ubuntuMono.variable}`}>
        <noscript>
          <div className="doc-wrap">
            <h1>Diwakar Adhikari</h1>
            <p className="doc-role">Technical Lead — AI Engineering</p>
            <p className="doc-lede">
              This portfolio is an interactive desktop and needs JavaScript. The plain versions work without
              it: <a href="/resume">résumé</a> · <a href="/writing">writing</a> ·{' '}
              <a href="https://github.com/Thunderk3g">GitHub</a>
            </p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
