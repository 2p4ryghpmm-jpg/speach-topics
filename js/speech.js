/*
 * Thin wrapper around Chrome's webkitSpeechRecognition.
 *
 * Chrome ends a recognition session after a stretch of silence (and
 * sometimes for no obvious reason), so while a speech is in progress we
 * transparently restart it and stitch the transcript together.
 */

import { joinSegments } from './analysis.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = () => Boolean(SR);

const FATAL = {
  'not-allowed': 'Microphone access was blocked. Allow it from the address bar and try again.',
  'service-not-allowed': 'Speech recognition is disabled in this browser. Please use Google Chrome.',
  'audio-capture': 'No microphone was found. Plug one in and try again.',
  'language-not-supported': 'That speech language isn’t supported. Pick another accent in Settings.',
  network: 'Chrome couldn’t reach its speech service. Check your connection. (Some Chromium browsers, like Brave, block it.)',
};

export class SpeechSession {
  /**
   * @param {{lang: string, onUpdate: (s: {final: string, interim: string}) => void, onError: (msg: string) => void}} opts
   */
  constructor({ lang, onUpdate, onError }) {
    this.lang = lang;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.segments = []; // [{ text, start, end }], one per final recognition result
    this.segStart = null;
    this.interim = '';
    this.events = [];
    this.active = false;
    this.rec = null;
    this.live = false;
    this.t0 = 0;
    this.restarts = [];
  }

  get finalText() {
    return joinSegments(this.segments).text;
  }

  get text() {
    return `${this.finalText} ${this.interim}`.replace(/\s+/g, ' ').trim();
  }

  start(t0 = performance.now()) {
    this.t0 = t0;
    this.active = true;
    this._spawn();
  }

  _spawn() {
    const rec = new SR();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const now = performance.now() - this.t0;
      // Finals before resultIndex were already delivered; interim text is rebuilt each time.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) this._pushSegment(e.results[i][0].transcript, now);
      }
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
      }
      this.interim = interim.trim();
      if (this.interim && this.segStart == null) this.segStart = now;
      const words = (this.text.match(/\S+/g) || []).length;
      this.events.push({ t: now, words });
      this.onUpdate?.({ final: this.finalText, interim: this.interim });
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const msg = FATAL[e.error];
      if (msg) {
        this.active = false;
        this.onError?.(msg, e.error);
      }
    };

    rec.onend = () => {
      if (this.rec !== rec) return;
      this.live = false;
      // Anything still interim when a session ends would otherwise be lost.
      this._commitInterim();
      if (this.active) {
        const now = performance.now();
        this.restarts = this.restarts.filter((t) => now - t < 5000);
        this.restarts.push(now);
        if (this.restarts.length > 6) {
          this.active = false;
          this.onError?.('Speech recognition keeps stopping. Check your microphone and connection.', 'loop');
          return;
        }
        try { this._spawn(); } catch { /* ignore */ }
      } else {
        this._resolveStop?.();
      }
    };

    this.rec = rec;
    this.live = true;
    rec.start();
  }

  /** Forget anything heard so far and re-base timestamps (used at "go"). */
  reset(t0 = performance.now()) {
    this.t0 = t0;
    this.segments = [];
    this.segStart = null;
    this.interim = '';
    this.events = [];
  }

  _pushSegment(text, now) {
    const t = text.trim();
    if (t) this.segments.push({ text: t, start: this.segStart ?? now, end: now });
    this.segStart = null;
  }

  _commitInterim() {
    if (this.interim) {
      this._pushSegment(this.interim, performance.now() - this.t0);
      this.interim = '';
      this.onUpdate?.({ final: this.finalText, interim: '' });
    }
  }

  /** Character offsets where each segment starts in `finalText`. */
  get segmentOffsets() {
    return joinSegments(this.segments).offsets;
  }

  /** Stop listening; resolves once Chrome has delivered its final results. */
  stop() {
    this.active = false;
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this._resolveStop = null;
        this._commitInterim();
        resolve(this.finalText);
      };
      const timer = setTimeout(done, 2500);
      this._resolveStop = done;
      if (!this.live) return done();
      try { this.rec?.stop(); } catch { done(); }
    });
  }

  /** Abandon immediately, discarding pending results. */
  abort() {
    this.active = false;
    const rec = this.rec;
    this.rec = null;
    try { rec?.abort(); } catch { /* ignore */ }
  }
}
