// Tiny synthesized chimes. No external audio files — keeps the bundle small
// and the app fully offline-capable.

let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, when = 0, type = 'sine', gain = 0.18) {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g).connect(c.destination);
  const start = c.currentTime + when;
  osc.start(start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.stop(start + duration + 0.05);
}

export function happyChime() {
  // Major arpeggio C E G
  tone(523.25, 0.18, 0);
  tone(659.25, 0.18, 0.10);
  tone(783.99, 0.30, 0.20);
}

export function softChime() {
  // Two soft notes, slightly down — for retry needed
  tone(440, 0.22, 0, 'sine', 0.14);
  tone(370, 0.30, 0.12, 'sine', 0.14);
}

export function celebrationFanfare() {
  // C E G C up
  tone(523.25, 0.20, 0);
  tone(659.25, 0.20, 0.12);
  tone(783.99, 0.20, 0.24);
  tone(1046.50, 0.40, 0.36, 'triangle', 0.20);
}

export function tapClick() {
  tone(880, 0.05, 0, 'square', 0.06);
}
