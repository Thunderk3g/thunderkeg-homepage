// All sounds are synthesized live with WebAudio — no audio files needed.

let ctx = null, out = null, noiseBuf = null, muted = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 0.9;
    out.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) {
  muted = m;
  if (out) out.gain.value = m ? 0 : 0.9;
  if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
}

function noise() {
  if (!noiseBuf) {
    const c = ac();
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function gain(dest = out) { const g = ctx.createGain(); g.connect(dest); return g; }

function env(g, t, attack, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(type, f, t, dur, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function noiseSrc(t, dur, dest) {
  const s = ctx.createBufferSource();
  s.buffer = noise();
  s.connect(dest);
  s.start(t, Math.random() * 0.9);
  s.stop(t + dur);
  return s;
}

function filter(type, freq, dest, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  f.connect(dest);
  return f;
}

function shaper(k, dest) {
  const ws = ctx.createWaveShaper();
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  ws.curve = curve;
  ws.connect(dest);
  return ws;
}

export const sfx = {
  unlock() { ac(); },

  // Vine boom
  boom() {
    const c = ac(), t = c.currentTime;
    const g = gain(); env(g, t, 0.005, 1, 1.4);
    const ws = shaper(8, g);
    osc('sine', 140, t, 1.5, ws).frequency.exponentialRampToValueAtTime(38, t + 0.9);
    osc('triangle', 70, t, 1.2, ws).frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const ng = gain(); env(ng, t, 0.002, 0.6, 0.12);
    noiseSrc(t, 0.2, filter('lowpass', 1200, ng));
  },

  beep(f = 880, dur = 0.08, type = 'square', vol = 0.18) {
    const c = ac(), t = c.currentTime;
    const g = gain(); env(g, t, 0.005, vol, dur);
    osc(type, f, t, dur + 0.02, g);
  },

  scan() {
    const c = ac(), t = c.currentTime;
    const g = gain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
    g.gain.setValueAtTime(0.12, t + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    const bp = filter('bandpass', 1200, g, 4);
    const o = osc('sawtooth', 180, t, 2, bp);
    o.frequency.exponentialRampToValueAtTime(1400, t + 2);
    const lg = ctx.createGain(); lg.gain.value = 400;
    lg.connect(bp.frequency);
    osc('square', 14, t, 2, lg);
  },

  whoosh() {
    const c = ac(), t = c.currentTime;
    const g = gain(); env(g, t, 0.18, 0.5, 0.3);
    const bp = filter('bandpass', 300, g, 2);
    bp.frequency.exponentialRampToValueAtTime(4000, t + 0.25);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    noiseSrc(t, 0.55, bp);
  },

  hit() {
    const c = ac(), t = c.currentTime;
    const g = gain(); env(g, t, 0.003, 1, 0.25);
    osc('sine', 180, t, 0.3, shaper(5, g)).frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const ng = gain(); env(ng, t, 0.001, 0.5, 0.08);
    noiseSrc(t, 0.1, filter('highpass', 2000, ng));
  },

  airhorn() {
    const c = ac(), t0 = c.currentTime;
    [[0, 0.12], [0.16, 0.12], [0.32, 0.12], [0.5, 0.75]].forEach(([s, d]) => {
      const t = t0 + s;
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.setValueAtTime(0.3, t + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
      const ws = shaper(4, filter('lowpass', 3000, g));
      for (const f of [466, 469, 932, 698]) {
        osc('sawtooth', f * 0.96, t, d + 0.1, ws).frequency.linearRampToValueAtTime(f, t + 0.05);
      }
    });
  },

  sad() {
    const c = ac(), t0 = c.currentTime;
    [[0, 0.35, 392], [0.4, 0.35, 370], [0.8, 0.35, 349], [1.2, 1.2, 330]].forEach(([s, d, f], i) => {
      const t = t0 + s;
      const g = gain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
      g.gain.setValueAtTime(0.25, t + d - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const o = osc('sawtooth', f, t, d, filter('lowpass', 1000, g));
      if (i === 3) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
        const lg = ctx.createGain(); lg.gain.value = 8;
        lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + d);
      }
    });
  },

  ding() {
    const c = ac(), t = c.currentTime;
    for (const [f, v] of [[1318, 0.25], [1976, 0.12], [2637, 0.06]]) {
      const g = gain(); env(g, t, 0.003, v, 1.3);
      osc('sine', f, t, 1.4, g);
    }
  },

  riser() {
    const c = ac(), t = c.currentTime;
    const g = gain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    const bp = filter('bandpass', 400, g, 3);
    bp.frequency.exponentialRampToValueAtTime(6000, t + 1);
    noiseSrc(t, 1, bp);
    osc('sawtooth', 110, t, 1, filter('lowpass', 2500, gain(g))).frequency.exponentialRampToValueAtTime(880, t + 1);
  },

  shh() {
    const c = ac(), t = c.currentTime;
    const g = gain(); env(g, t, 0.15, 0.4, 0.9);
    noiseSrc(t, 1.1, filter('bandpass', 4500, g, 1.5));
  },
};

sfx.gunshot = () => {
  const c = ac(), t = c.currentTime;
  const g = gain(); env(g, t, 0.001, 0.9, 0.16);
  noiseSrc(t, 0.22, filter('bandpass', 1800, shaper(12, g), 0.7));
  const tg = gain(); env(tg, t, 0.002, 0.8, 0.12);
  osc('sine', 130, t, 0.15, tg).frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const tail = gain(); env(tail, t + 0.01, 0.01, 0.25, 0.35);
  noiseSrc(t, 0.4, filter('lowpass', 900, tail));
};

// GTA-style "wasted" slow-mo drop.
sfx.wasted = () => {
  const c = ac(), t = c.currentTime;
  const g = gain(); env(g, t, 0.01, 0.9, 1.6);
  osc('sine', 90, t, 1.7, shaper(4, g)).frequency.exponentialRampToValueAtTime(28, t + 1.5);
  const ng = gain(); env(ng, t, 0.05, 0.4, 1.2);
  const lp = filter('lowpass', 3000, ng);
  lp.frequency.exponentialRampToValueAtTime(150, t + 1.2);
  noiseSrc(t, 1.3, lp);
};

// "Mission passed" jingle.
sfx.passed = () => {
  const c = ac(), t0 = c.currentTime;
  [[0, 523], [0.12, 659], [0.24, 784], [0.36, 1046]].forEach(([s, f], i) => {
    const t = t0 + s, d = i === 3 ? 1.2 : 0.14;
    const g = gain(); env(g, t, 0.01, 0.22, d);
    osc('triangle', f, t, d + 0.05, g);
    osc('square', f / 2, t, d + 0.05, filter('lowpass', 1200, gain(g)));
  });
};

// FAAAAH — a formant-synthesized scream ("f" hiss + "aah" vowel), one voice per style.
const FAAAH_VOICES = [
  { pitch: 95, rise: 1.25, dist: 30, echo: 0.35, voices: [1], vib: 4 },               // SIGMA: deep + echo
  { pitch: 230, rise: 1.5, dist: 250, echo: 0, voices: [1], vib: 9 },                 // DEEP FRIED: blown out
  { pitch: 150, rise: 1.2, dist: 4, echo: 0.45, voices: [1, 1.26, 1.5], vib: 5 },     // GIGACHAD: choir
  { pitch: 130, rise: 1, dist: 10, echo: 0, voices: [1], vib: 0, robot: true, stutter: true }, // NPC: robot
  { pitch: 55, rise: 0.75, dist: 60, echo: 0.5, voices: [1, 0.5], vib: 3 },           // DEMON: sub-bass
  { pitch: 390, rise: 1.6, dist: 8, echo: 0.3, voices: [1], vib: 12 },                // VAPORWAVE: chipmunk
];

sfx.faaah = (variant = 0, dur = 1.3) => {
  const c = ac(), v = FAAAH_VOICES[variant % FAAAH_VOICES.length], t0 = c.currentTime;
  const bus = gain(); bus.gain.value = 0.5;
  if (v.echo) {
    const d = c.createDelay(1); d.delayTime.value = 0.19;
    const fb = c.createGain(); fb.gain.value = v.echo;
    bus.connect(d); d.connect(fb).connect(d); d.connect(out);
    setTimeout(() => { d.disconnect(); fb.disconnect(); }, (dur + 4) * 1000);
  }
  const starts = v.stutter ? [0, 0.17, 0.34] : [0];
  starts.forEach((s, k) => {
    const t = t0 + s, fric = 0.12;
    const fg = gain(bus); env(fg, t, 0.02, 0.35, fric);
    noiseSrc(t, fric + 0.05, filter('highpass', 2500, fg));

    const vt = t + fric * 0.8, vd = k === starts.length - 1 ? dur : 0.09;
    const vg = gain(bus);
    vg.gain.setValueAtTime(0.0001, vt);
    vg.gain.exponentialRampToValueAtTime(0.9, vt + 0.05);
    vg.gain.setValueAtTime(0.9, vt + vd * 0.7);
    vg.gain.exponentialRampToValueAtTime(0.0001, vt + vd);
    const sh = shaper(v.dist, vg);
    const formants = [[800, 1, 5], [1150, 0.6, 6], [2900, 0.25, 8]].map(([f, g2, q]) => {
      const fgain = gain(sh); fgain.gain.value = g2;
      return filter('bandpass', f, fgain, q);
    });
    for (const mult of v.voices) {
      const p = v.pitch * mult;
      const o = ctx.createOscillator();
      o.type = v.robot ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(p * 0.92, vt);
      o.frequency.linearRampToValueAtTime(p * v.rise, vt + vd * 0.3);
      o.frequency.linearRampToValueAtTime(p * (v.robot ? 1 : 0.8), vt + vd);
      if (v.vib) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = v.vib;
        const lg = ctx.createGain(); lg.gain.value = p * 0.03;
        lfo.connect(lg).connect(o.frequency); lfo.start(vt); lfo.stop(vt + vd + 0.05);
      }
      formants.forEach(fl => o.connect(fl));
      o.start(vt); o.stop(vt + vd + 0.05);
    }
  });
};

// Phonk loop: 808s, clap, hats and that cursed cowbell melody.
const COWBELL = [0, null, 0, 0, 3, null, 0, null, 7, null, 0, 0, 5, null, 3, null,
                 0, null, 0, 0, 3, null, 0, null, 10, null, 8, null, 7, 7, 5, null];
const KICK = new Set([0, 10, 16, 26, 28]);
const CLAP = new Set([8, 24]);

export const phonk = {
  timer: null, step: 0, next: 0,
  start(bpm = 130) {
    const c = ac();
    this.stop();
    this.step = 0;
    this.next = c.currentTime + 0.05;
    const spb = 60 / bpm / 4;
    this.timer = setInterval(() => {
      while (this.next < c.currentTime + 0.12) {
        this.play(this.step % 32, this.next);
        this.next += spb;
        this.step++;
      }
    }, 25);
  },
  stop() { clearInterval(this.timer); this.timer = null; },
  play(s, t) {
    if (KICK.has(s)) {
      const g = gain(); env(g, t, 0.005, 0.9, 0.6);
      osc('sine', 140, t, 0.7, shaper(3, g)).frequency.exponentialRampToValueAtTime(49, t + 0.06);
    }
    if (CLAP.has(s)) {
      for (const off of [0, 0.012, 0.024]) {
        const g = gain(); env(g, t + off, 0.002, 0.35, 0.12);
        noiseSrc(t + off, 0.16, filter('bandpass', 1300, g, 1));
      }
    }
    if (s % 2 === 0 || s >= 29) {
      const g = gain(); env(g, t, 0.001, 0.08, 0.04);
      noiseSrc(t, 0.06, filter('highpass', 8000, g));
    }
    const n = COWBELL[s];
    if (n !== null) {
      const f = 587 * Math.pow(2, n / 12);
      const g = gain(); env(g, t, 0.002, 0.16, 0.28);
      const bp = filter('bandpass', f * 1.4, g, 3);
      osc('square', f, t, 0.3, bp);
      osc('square', f * 1.48, t, 0.3, bp);
    }
  },
};

export function speak(text, { pitch = 0.4, rate = 0.95 } = {}) {
  if (muted || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const v = voices.find(v => /^en/i.test(v.lang) && /(david|daniel|george|guy|mark|alex|male)/i.test(v.name))
    || voices.find(v => /^en/i.test(v.lang));
  if (v) u.voice = v;
  u.pitch = pitch;
  u.rate = rate;
  speechSynthesis.speak(u);
}

// 8-bit chiptune music + arcade blips for MOG QUEST.
const CHIP_LEAD = [0, null, 7, null, 12, null, 7, null, 3, null, 10, null, 15, null, 10, null,
                   5, null, 12, null, 17, null, 12, null, 7, null, 14, null, 19, null, 14, 12];
const CHIP_BASS = [-24, -21, -19, -17];

function blip(type, f, t, dur, vol, f2) {
  const g = gain(); env(g, t, 0.002, vol, dur);
  const o = osc(type, f, t, dur + 0.02, g);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
}

export const chip = {
  timer: null, step: 0, next: 0,
  start(bpm = 150) {
    const c = ac();
    this.stop();
    this.step = 0;
    this.next = c.currentTime + 0.05;
    const spb = 60 / bpm / 4;
    this.timer = setInterval(() => {
      while (this.next < c.currentTime + 0.12) {
        this.play(this.step % 32, this.next);
        this.next += spb;
        this.step++;
      }
    }, 25);
  },
  stop() { clearInterval(this.timer); this.timer = null; },
  play(s, t) {
    const n = CHIP_LEAD[s];
    if (n !== null) blip('square', 440 * Math.pow(2, n / 12), t, 0.11, 0.06);
    if (s % 2 === 0) blip('triangle', 440 * Math.pow(2, CHIP_BASS[Math.floor(s / 8)] / 12), t, 0.14, 0.18);
    if (s % 4 === 2) {
      const g = gain(); env(g, t, 0.001, 0.05, 0.03);
      noiseSrc(t, 0.04, filter('highpass', 7000, g));
    }
  },
  coin() { const t = ac().currentTime; blip('square', 988, t, 0.06, 0.12); blip('square', 1319, t + 0.06, 0.12, 0.12); },
  blip() { blip('square', 660, ac().currentTime, 0.06, 0.12); },
  hurt() { const t = ac().currentTime; blip('square', 220, t, 0.25, 0.18, 60); const g = gain(); env(g, t, 0.002, 0.2, 0.15); noiseSrc(t, 0.2, filter('lowpass', 1500, g)); },
  power() { blip('triangle', 300, ac().currentTime, 0.35, 0.25, 1400); },
  laser() { blip('square', 1800, ac().currentTime, 0.18, 0.1, 180); },
  warn() { const t = ac().currentTime; blip('square', 880, t, 0.07, 0.1); blip('square', 660, t + 0.1, 0.07, 0.1); },
  down() { const t = ac().currentTime; [660, 520, 390].forEach((f, k) => blip('square', f, t + k * 0.1, 0.09, 0.12)); },
  bomb() { const t = ac().currentTime; const g = gain(); env(g, t, 0.002, 0.7, 0.6); noiseSrc(t, 0.7, filter('lowpass', 700, shaper(6, g))); blip('sine', 120, t, 0.5, 0.5, 30); },
  evolve() { const t = ac().currentTime; [523, 659, 784, 1046, 1319, 1568, 2093].forEach((f, k) => blip('square', f, t + k * 0.06, 0.08, 0.1)); },
  win() { const t = ac().currentTime; [[0, 523], [0.15, 659], [0.3, 784], [0.45, 1046], [0.7, 784], [0.85, 1046]].forEach(([d, f], k) => blip('square', f, t + d, k === 5 ? 0.6 : 0.13, 0.13)); },
};
