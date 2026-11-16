import type { Metadata } from 'next';
import { SteerableCanvas } from '@/steer/SteerableCanvas';

export const metadata: Metadata = {
  title: 'Steerable canvas — Diwakar Adhikari',
  description:
    'A writing surface where the text is shaped while it is generated: a focus monitor, attention locks, six steering dials and a main knob that scrubs through alternative continuations.',
  alternates: { canonical: '/steer' },
};

/** The canvas on its own, full screen. The same component runs as an app on the desktop. */
export default function SteerPage() {
  return (
    <main style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }}>
      <SteerableCanvas wsUrl={process.env.NEXT_PUBLIC_STEER_WS_URL || undefined} autoFocus />
    </main>
  );
}
