/*
 * Web Audio helpers: a shared AudioContext, synthesised chimes,
 * and a microphone monitor used for the live visualiser and pause detection.
 */

let ctx = null;

/** Create / resume the shared AudioContext. Call from a user gesture. */
export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

let muted = false;
export const setMuted = (m) => { muted = m; };

/** A soft bell: a few inharmonic partials with an exponential decay. */
function bell(freq, when, { gain = 0.22, decay = 2.2 } = {}) {
  const partials = [
    [1, 1],
    [2.01, 0.42],
    [2.76, 0.28],
    [5.4, 0.09],
  ];
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, when);
  out.gain.linearRampToValueAtTime(gain, when + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  out.connect(ctx.destination);
  for (const [ratio, amp] of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    g.gain.value = amp;
    osc.connect(g).connect(out);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }
}

export const chimes = {
  /** Prep finished: a rising three-note arpeggio, twice. */
  prepDone() {
    if (muted || !ensureAudio()) return;
    const t = ctx.currentTime + 0.05;
    const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5
    notes.forEach((f, i) => bell(f, t + i * 0.16));
    notes.forEach((f, i) => bell(f * 2, t + 0.9 + i * 0.16, { gain: 0.14 }));
  },
  /** Speech finished: one warm, low bell. */
  speechDone() {
    if (muted || !ensureAudio()) return;
    const t = ctx.currentTime + 0.02;
    bell(523.25, t, { gain: 0.2, decay: 2.6 });
    bell(783.99, t + 0.12, { gain: 0.12, decay: 2.4 });
  },
  /** Short tick for the 3-2-1 countdown. */
  tick(final = false) {
    if (muted || !ensureAudio()) return;
    bell(final ? 1318.5 : 880, ctx.currentTime + 0.01, { gain: final ? 0.16 : 0.1, decay: final ? 0.9 : 0.35 });
  },
  /** Gentle blip used when the spin lands. */
  land(freq = 740) {
    if (muted || !ensureAudio()) return;
    bell(freq, ctx.currentTime + 0.01, { gain: 0.07, decay: 0.8 });
  },
};

/**
 * Microphone monitor. Exposes frequency data for the visualiser and
 * records a level (dBFS) sample every `sampleMs` for pause detection.
 */
export class MicMonitor {
  constructor() {
    this.stream = null;
    this.analyser = null;
    this.freq = null;
    this.samples = [];
    this.t0 = 0;
    this.recording = false;
  }

  async open() {
    ensureAudio();
    // Auto-gain is off: it pumps up room noise during pauses, which hides them.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    const src = ctx.createMediaStreamSource(this.stream);

    // Smoothed analyser for the visualiser.
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.72;
    src.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    // Unsmoothed analyser for voice-activity detection.
    this.vad = ctx.createAnalyser();
    this.vad.fftSize = 2048;
    this.vad.smoothingTimeConstant = 0;
    src.connect(this.vad);
    this.spec = new Float32Array(this.vad.frequencyBinCount);
    const bin = (hz) => Math.min(this.spec.length, Math.max(1, Math.round(hz / (ctx.sampleRate / this.vad.fftSize))));
    this.bands = {
      voice: [bin(250), bin(4000)], // where speech energy lives
      low: [bin(80), bin(1000)], // vowels and "mmm" murmurs
      high: [bin(1000), bin(4000)], // hiss: breaths, fricatives, clicks
    };
    this.source = src;
  }

  /**
   * Speech-band level in dB, plus low-vs-high spectral balance (dB).
   * Near-silent input reads as a very low level rather than being skipped,
   * so a quiet pause is always counted as a pause.
   */
  measure() {
    if (!this.vad) return null;
    this.vad.getFloatFrequencyData(this.spec);
    const power = ([a, b]) => {
      let p = 0;
      for (let i = a; i < b; i++) {
        const v = this.spec[i];
        if (v > -200) p += 10 ** (v / 10);
      }
      return p;
    };
    const db = (p) => (p > 0 ? 10 * Math.log10(p) : -140);
    return { db: db(power(this.bands.voice)), lh: db(power(this.bands.low)) - db(power(this.bands.high)) };
  }

  /** Fill and return the frequency buffer (0–255 per bin). */
  frequencies() {
    if (this.analyser) this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }

  startRecording(t0) {
    this.samples = [];
    this.t0 = t0;
    this.recording = true;
  }

  /** Call regularly (the app drives this from its ticker). */
  sample(now) {
    if (!this.recording) return;
    const m = this.measure();
    if (m) this.samples.push({ t: now - this.t0, db: m.db, lh: m.lh });
  }

  stopRecording() {
    this.recording = false;
    return this.samples;
  }

  close() {
    this.recording = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.source) this.source.disconnect();
    this.stream = null;
    this.analyser = null;
    this.vad = null;
    this.source = null;
  }
}
