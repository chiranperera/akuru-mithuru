// Audio cues. Tries file-based first, falls back to synthesized chimes.
//
// Drop mp3 files in /audio/ to override:
//   /audio/success.mp3      — letter/word identified correctly
//   /audio/failure.mp3      — letter/word missed (after retry)
//   /audio/retry.mp3        — first attempt wrong, "look again"
//   /audio/celebration.mp3  — tier completion fanfare
//   /audio/tap.mp3          — UI button click (optional)
//
// On module load we probe each path with a HEAD request; if the file is
// present, future calls play it. If not, the synth fallback runs.

const FILE_MAP = {
  success: '/audio/success.mp3',
  failure: '/audio/failure.mp3',
  retry: '/audio/retry.mp3',
  celebration: '/audio/celebration.mp3',
  tap: '/audio/tap.mp3'
};

const audioInstances = {};
const probed = {};

(function probeAll() {
  for (const [name, url] of Object.entries(FILE_MAP)) {
    fetch(url, { method: 'HEAD' })
      .then(res => {
        if (res.ok) {
          const audio = new Audio(url);
          audio.preload = 'auto';
          audio.volume = 0.85;
          audioInstances[name] = audio;
        }
        probed[name] = true;
      })
      .catch(() => { probed[name] = true; });
  }
})();

function playFileOrSynth(name, synthFn) {
  const audio = audioInstances[name];
  if (audio) {
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => synthFn());
      return;
    } catch (e) {
      // fall through to synth
    }
  }
  synthFn();
}

// ---- Synth fallbacks ----

let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
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

// ---- Public API ----

export function happyChime() {
  // Successful identification — major arpeggio.
  playFileOrSynth('success', () => {
    tone(523.25, 0.18, 0);
    tone(659.25, 0.18, 0.10);
    tone(783.99, 0.30, 0.20);
  });
}

export function failChime() {
  // Final miss after retry — descending minor.
  playFileOrSynth('failure', () => {
    tone(330, 0.18, 0, 'sawtooth', 0.14);
    tone(247, 0.30, 0.12, 'sawtooth', 0.14);
  });
}

export function softChime() {
  // First wrong — "let's try again" — gentle, not punitive.
  playFileOrSynth('retry', () => {
    tone(440, 0.22, 0, 'sine', 0.14);
    tone(370, 0.30, 0.12, 'sine', 0.14);
  });
}

export function celebrationFanfare() {
  // Tier complete — rising arpeggio plus triangle topper.
  playFileOrSynth('celebration', () => {
    tone(523.25, 0.20, 0);
    tone(659.25, 0.20, 0.12);
    tone(783.99, 0.20, 0.24);
    tone(1046.50, 0.40, 0.36, 'triangle', 0.20);
  });
}

export function tapClick() {
  playFileOrSynth('tap', () => {
    tone(880, 0.05, 0, 'square', 0.06);
  });
}
