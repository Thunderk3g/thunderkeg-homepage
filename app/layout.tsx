import type { Metadata } from 'next';
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ubuntu.variable} ${ubuntuMono.variable}`}>{children}</body>
    </html>
  );
}
