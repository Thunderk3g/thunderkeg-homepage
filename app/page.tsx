'use client';

import dynamic from 'next/dynamic';

const KaliOS = dynamic(() => import('@/os/KaliOS'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0e14',
        color: '#7aa2f7',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'monospace',
        fontSize: 14,
        letterSpacing: 1,
      }}
    >
      booting kali…
    </div>
  ),
});

export default function Page() {
  return <KaliOS />;
}
