import { ImageResponse } from 'next/og';
import { hire, profile } from '@/data/resume';

export const dynamic = 'force-static';
export const alt = 'Diwakar Adhikari — Technical Lead, AI Engineering';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** One isometric stack, the same drawing as the desktop wallpaper's columns. */
function Stack({ x, y, n, top, left, right }: { x: number; y: number; n: number; top: string; left: string; right: string }) {
  const w = 46;
  const h = 23;
  const c = 26;
  const H = n * c;
  return (
    <svg
      width={w * 2}
      height={H + h * 2}
      viewBox={`0 0 ${w * 2} ${H + h * 2}`}
      style={{ position: 'absolute', left: x, top: y - H }}
    >
      <path d={`M0 ${h} L${w} ${h * 2} L${w} ${h * 2 + H} L0 ${h + H} Z`} fill={left} />
      <path d={`M${w * 2} ${h} L${w} ${h * 2} L${w} ${h * 2 + H} L${w * 2} ${h + H} Z`} fill={right} />
      <path d={`M0 ${h} L${w} 0 L${w * 2} ${h} L${w} ${h * 2} Z`} fill={top} />
    </svg>
  );
}

export default function OpengraphImage() {
  const blue = { top: '#9dbdff', left: '#4173ea', right: '#2b51b8' };
  const dim = { top: '#4f63a6', left: '#313f7c', right: '#252f60' };
  const violet = { top: '#bda8ff', left: '#7a5cdb', right: '#553aa9' };
  const teal = { top: '#86f2db', left: '#30b59d', right: '#1f8272' };
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #171c4a 0%, #0d1033 55%, #070818 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <Stack x={820} y={300} n={5} {...blue} />
        <Stack x={912} y={346} n={3} {...dim} />
        <Stack x={728} y={346} n={4} {...blue} />
        <Stack x={820} y={392} n={2} {...violet} />
        <Stack x={1004} y={392} n={4} {...violet} />
        <Stack x={912} y={438} n={1} {...teal} />
        <Stack x={636} y={392} n={2} {...dim} />
        <Stack x={728} y={438} n={3} {...teal} />

        <div style={{ display: 'flex', fontSize: 26, color: '#86f2db' }}>kali@kali:~$ whoami</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>Diwakar Adhikari</div>
          <div style={{ display: 'flex', fontSize: 34, color: '#9dbdff', marginTop: 8 }}>{profile.title}</div>
          <div style={{ display: 'flex', fontSize: 28, color: '#c9cddb', marginTop: 22, maxWidth: 600 }}>
            {profile.tagline}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: '#d9fbe8' }}>
          {hire.open && (
            <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: '#3ddc84', marginRight: 14 }} />
          )}
          {hire.open ? hire.status : 'Research notes and a portfolio you can boot'}
        </div>
      </div>
    ),
    size,
  );
}
