// Мини-синтезатор звуков на WebAudio — без файлов.
let ctx: AudioContext | null = null;
let muted = false;
const last: Record<string, number> = {};

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.05, slideTo?: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function limited(key: string, gap: number): boolean {
  const now = performance.now();
  if (last[key] && now - last[key] < gap) return false;
  last[key] = now;
  return true;
}

export const sfx = {
  toggleMute() {
    muted = !muted;
    return muted;
  },
  isMuted: () => muted,
  unlock() {
    ac();
  },
  shoot() {
    if (limited('shoot', 90)) tone(900, 0.06, 'triangle', 0.02, 500);
  },
  hit() {
    if (limited('hit', 40)) tone(240, 0.05, 'square', 0.025, 120);
  },
  pop() {
    if (limited('pop', 35)) tone(420, 0.08, 'triangle', 0.035, 160);
  },
  gem() {
    if (limited('gem', 45)) tone(660 + Math.random() * 300, 0.07, 'sine', 0.035, 1200);
  },
  hurt() {
    if (limited('hurt', 90)) tone(160, 0.18, 'sawtooth', 0.06, 60);
  },
  boing() {
    tone(180, 0.35, 'sine', 0.08, 700);
    tone(700, 0.3, 'sine', 0.05, 200, 0.2);
  },
  reject() {
    if (limited('reject', 80)) tone(300, 0.1, 'square', 0.03, 150);
  },
  squeak() {
    tone(900, 0.12, 'triangle', 0.06, 1500);
    tone(1500, 0.1, 'triangle', 0.05, 800, 0.1);
  },
  levelup() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.06, undefined, i * 0.08));
  },
  gift() {
    [784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'sine', 0.06, undefined, i * 0.06));
  },
  siren() {
    for (let i = 0; i < 4; i++) {
      tone(500, 0.2, 'sawtooth', 0.05, 900, i * 0.22);
    }
  },
  boss() {
    tone(90, 0.7, 'sawtooth', 0.09, 50);
    tone(130, 0.7, 'square', 0.05, 70, 0.1);
  },
  win() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, undefined, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.06, undefined, i * 0.2));
  },
  click() {
    tone(600, 0.05, 'square', 0.04);
  },
};
