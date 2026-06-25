// Tiny WebAudio cues — no audio assets needed.
let ctx: AudioContext | null = null;

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** the classic "mission passed" triumphant chord, approximated */
export function missionPassedSting() {
  const a = ac();
  if (!a) return;
  const now = a.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, now + i * 0.07);
    g.gain.linearRampToValueAtTime(0.12, now + i * 0.07 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    o.connect(g).connect(a.destination);
    o.start(now + i * 0.07);
    o.stop(now + 1.8);
  });
}

export function blip() {
  const a = ac();
  if (!a) return;
  const now = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'square';
  o.frequency.value = 880;
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o.connect(g).connect(a.destination);
  o.start(now);
  o.stop(now + 0.15);
}
