// Per-friend personas: every face in the camera gets its own live filter,
// decoration and FAAAAH voice (index matches the sfx.faaah variant).
export const STYLES = [
  { name: 'SIGMA', emoji: '🗿', color: '#ff2e4d', fx: 'laser', tpl: 'sigma', shout: 'FAAAAAAH',
    filter: 'grayscale(1) contrast(1.7) brightness(0.9)' },
  { name: 'DEEP FRIED', emoji: '🔥', color: '#ff7a00', fx: 'fried', tpl: 'deepfry', shout: 'FAAAAAAAAAH 😂',
    filter: 'saturate(5) contrast(2.2) brightness(1.1) hue-rotate(-15deg)' },
  { name: 'GIGACHAD GOLD', emoji: '👑', color: '#ffd400', fx: 'gold', tpl: 'card', shout: 'FAAAAAH ✨',
    filter: 'sepia(1) saturate(3) contrast(1.25) brightness(1.1)' },
  { name: 'NPC', emoji: '🤖', color: '#28ff8a', fx: 'npc', tpl: 'mogged', shout: 'F-F-FAAAH',
    filter: 'grayscale(0.4) contrast(1.2)' },
  { name: 'DEMON', emoji: '😈', color: '#b026ff', fx: 'demon', tpl: 'sigma', shout: 'FAAAAAAAAAAAH',
    filter: 'saturate(2.5) hue-rotate(-35deg) contrast(1.6) brightness(0.75)' },
  { name: 'VAPORWAVE', emoji: '😎', color: '#ff4dd2', fx: 'vapor', tpl: 'mewing', shout: 'faaaaaah~',
    filter: 'hue-rotate(260deg) saturate(2.5) contrast(1.1)' },
];

// Fighters saved before styles existed get a stable style from their id.
export function styleOf(f) {
  if (Number.isInteger(f?.style)) return f.style % STYLES.length;
  let h = 0;
  for (const ch of String(f?.id ?? '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % STYLES.length;
}
