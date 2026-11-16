// Sound effects and screen feedback (screen shake and hit flashes).
//
// Sounds are made on the fly with the Web Audio API, so there are no sound
// files. Browsers only allow audio after the player has clicked or pressed a
// key, so the audio starts on the first input.
//
// Sound and shake/flash can each be switched off. The choice is saved under
// its own key (CONFIG.feedback.settingsKey), so Reset Progress keeps it.

const feedback = {
  settings: { sound: true, effects: true, volume: CONFIG.feedback.volume.default },
  ctx: null,       // AudioContext, made on the first click or key press
  master: null,    // master volume
  noiseBuf: null,  // a second of white noise, for BOOMs, CRACKs and digging
  voices: 0,       // sounds playing right now
  last: {},        // sound name -> when it last started (audio time)
  shake: 0,        // current shake strength, in % of screen
  shakeX: 0,       // this frame's offset, in px
  shakeY: 0,
};

// ---------- Settings ----------

function loadSettings() {
  const s = feedback.settings;
  // Shake and flashes start off for people who've asked their system for less motion.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) s.effects = false;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.feedback.settingsKey) || 'null');
    if (data && typeof data.sound === 'boolean') s.sound = data.sound;
    if (data && typeof data.effects === 'boolean') s.effects = data.effects;
    if (data && Number.isFinite(data.volume)) s.volume = clamp(data.volume, 0, 1);
  } catch (e) {
    // Unreadable settings: keep the defaults.
  }
}

function saveSettings() {
  try {
    localStorage.setItem(CONFIG.feedback.settingsKey, JSON.stringify(feedback.settings));
  } catch (e) {
    // Storage blocked: the setting still applies until the page is closed.
  }
}

// The master gain for a volume slider position (0..1).
function volumeGain(v = feedback.settings.volume) {
  return CONFIG.feedback.volume.maxGain * v * v;
}

// key is 'sound' or 'effects' (on is true/false), or 'volume' (on is 0..1).
function setSetting(key, on) {
  if (key === 'volume') on = clamp(Number(on) || 0, 0, 1);
  feedback.settings[key] = on;
  saveSettings();
  if (key === 'volume' && feedback.master) {
    // A short glide, so dragging the slider doesn't click.
    feedback.master.gain.setTargetAtTime(volumeGain(), feedback.ctx.currentTime, 0.02);
  }
  if (key === 'sound') {
    if (on) unlockAudio();
    else if (feedback.ctx && feedback.ctx.state === 'running') feedback.ctx.suspend();
  }
  if (key === 'effects' && !on) {
    feedback.shake = 0;
    feedback.shakeX = 0;
    feedback.shakeY = 0;
  }
}

loadSettings();

// ---------- Audio ----------

// Starts (or wakes) the audio. Must be called from a click or key press.
function unlockAudio() {
  if (!feedback.settings.sound) return;
  const AC = typeof AudioContext !== 'undefined' ? AudioContext
    : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null;
  if (!AC) return;
  if (!feedback.ctx) {
    try {
      feedback.ctx = new AC();
    } catch (e) {
      return;
    }
    const c = feedback.ctx;
    feedback.master = c.createGain();
    feedback.master.gain.value = volumeGain();
    // The compressor evens out loud moments so a turned-up game doesn't distort.
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    feedback.master.connect(comp);
    comp.connect(c.destination);
    feedback.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = feedback.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (feedback.ctx.state === 'suspended') feedback.ctx.resume();
}

function initFeedback() {
  // capture: true so the audio is ready before the click fires a shot.
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);
}

// Sends a sound source through a quick-attack, fading envelope (and an
// optional filter, and a pan from its x position) to the master volume.
function playVoice(src, t0, dur, peak, x, filter) {
  const c = feedback.ctx;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = src;
  if (filter) {
    node.connect(filter);
    node = filter;
  }
  node.connect(g);
  let out = g;
  // Sounds on the left of the battlefield come more from the left speaker.
  if (x !== undefined && c.createStereoPanner && world.w > 0) {
    const p = c.createStereoPanner();
    p.pan.value = clamp((x / world.w) * 2 - 1, -1, 1) * 0.6;
    g.connect(p);
    out = p;
  }
  out.connect(feedback.master);
  feedback.voices++;
  src.onended = () => { feedback.voices--; };
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// A tone sliding from f0 to f1 Hz.
function tone(type, f0, f1, dur, peak, { x, delay = 0 } = {}) {
  const c = feedback.ctx;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  playVoice(o, t0, dur, peak, x);
}

// Filtered noise, with the filter sliding from f0 to f1 Hz.
function noise(filterType, f0, f1, dur, peak, { x, delay = 0, q = 1 } = {}) {
  const c = feedback.ctx;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = feedback.noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  playVoice(src, t0, dur, peak, x, f);
}

// Every sound in the game. o holds x (for panning), and for some, size or pitch.
const SOUNDS = {
  shot:   o => tone('square', 900, 260, 0.07, 0.12, o),
  aiShot: o => tone('triangle', 720, 240, 0.05, 0.05, o),
  shell:  o => { tone('sine', 150, 45, 0.3, 0.45, o); noise('lowpass', 900, 120, 0.18, 0.25, o); },
  // size: 0 (tiny blast) to 1 (the biggest SHELL)
  boom:   o => {
    const k = clamp(o.size || 0.2, 0.1, 1);
    noise('lowpass', 500 + 1500 * k, 80, 0.18 + 0.4 * k, 0.12 + 0.35 * k, o);
  },
  // pitch: bigger animals die lower
  kill:   o => tone('sine', 520 * o.pitch, 1100 * o.pitch, 0.09, 0.12, o),
  crack:  o => { noise('highpass', 2500, 900, 0.1, 0.35, o); tone('square', 140, 55, 0.18, 0.12, o); },
  snap:   o => noise('bandpass', 3200, 1500, 0.07, 0.3, { ...o, q: 2 }),
  dig:    o => noise('lowpass', 320, 90, 0.45, 0.35, o),
  webbed: o => tone('sawtooth', 340, 170, 0.35, 0.06, o),
  buy:    () => { tone('triangle', 660, 660, 0.07, 0.15); tone('triangle', 990, 990, 0.1, 0.15, { delay: 0.07 }); },
  unlock: () => [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.12, 0.15, { delay: i * 0.08 })),
  achievement: () => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i === 3 ? 0.3 : 0.1, 0.07, { delay: i * 0.09 })),
  toast:  () => tone('sine', 880, 1040, 0.06, 0.05),
};

// Plays a sound by name, e.g. sfx('boom', { x: 300, size: 0.5 }).
// Does nothing if sound is off, the audio hasn't started yet, or too much is
// already playing. The same sound can't restart within CONFIG.feedback.minGap,
// so a crowd of AI units doesn't turn into a roar.
function sfx(name, opts = {}) {
  const c = feedback.ctx;
  if (!feedback.settings.sound || !c || c.state !== 'running' || !SOUNDS[name]) return;
  if (feedback.voices >= CONFIG.feedback.maxVoices) return;
  const now = c.currentTime;
  if (name in feedback.last && now - feedback.last[name] < CONFIG.feedback.minGap) return;
  feedback.last[name] = now;
  try {
    SOUNDS[name]({ pitch: 1, ...opts });
  } catch (e) {
    // A sound failing must never break the game.
  }
}

// ---------- Shake and flashes ----------

// amount is in % of screen.
function addShake(amount) {
  if (!feedback.settings.effects) return;
  feedback.shake = Math.min(CONFIG.feedback.shake.max, feedback.shake + amount);
}

function updateFeedback(dt) {
  feedback.shake *= Math.exp(-CONFIG.feedback.shake.decay * dt);
  if (feedback.shake < 0.01) feedback.shake = 0;
  const m = pct(feedback.shake);
  feedback.shakeX = rand(-m, m);
  feedback.shakeY = rand(-m, m);
}

// How strongly something is flashing from a hit right now, 0..1.
function flashOf(e) {
  if (!feedback.settings.effects || !(e.flash > 0)) return 0;
  return clamp(e.flash / CONFIG.feedback.hitFlashSeconds, 0, 1);
}
