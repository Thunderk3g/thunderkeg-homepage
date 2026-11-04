import type { Metadata, Viewport } from 'next';
import { Cantarell, Fira_Code } from 'next/font/google';
import './globals.css';

// Kali's Xfce defaults (kali-defaults): Cantarell 11 for the UI, Fira Code for
// QTerminal. The CSS variable names predate the switch and are kept because
// every app's stylesheet refers to them.
const uiFont = Cantarell({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-ubuntu',
  display: 'swap',
});

const monoFont = Fira_Code({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Diwakar Adhikari — Kali Linux Portfolio',
  description:
    'Technical Lead — AI Engineering. My portfolio rendered as a fully interactive, Kali-inspired Linux desktop — a working terminal, research and study tools, a real Linux VM booting in the browser, and PostgreSQL in WebAssembly. Plain résumé at /resume.',
  authors: [{ name: 'Diwakar Adhikari', url: 'https://github.com/Thunderk3g' }],
  openGraph: {
    type: 'website',
    title: 'Diwakar Adhikari — Technical Lead, AI Engineering',
    description:
      'Retrieval-grounded and speech AI, built where a wrong answer is a regulatory event. A portfolio you can boot: terminal, research tools, a real Linux VM and PostgreSQL.',
  },
  twitter: {
    card: 'summary',
    title: 'Diwakar Adhikari — Technical Lead, AI Engineering',
    description: 'Retrieval-grounded and speech AI. A portfolio rendered as a Kali Linux desktop.',
  },
};

export const viewport: Viewport = {
  themeColor: '#1a1c23',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${uiFont.variable} ${monoFont.variable}`}>
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
