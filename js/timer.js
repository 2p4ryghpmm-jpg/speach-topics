/*
 * Drift-free countdown.
 *
 * Ticks come from a tiny Web Worker because Chrome heavily throttles
 * main-thread timers in background tabs (down to once a minute after a
 * while). Worker timers aren't throttled that way, so the "prep's up"
 * alert still fires on time while you're researching in another tab.
 */

function makeTicker() {
  try {
    const src = `
      let id = null;
      onmessage = (e) => {
        clearInterval(id);
        if (e.data > 0) id = setInterval(() => postMessage(0), e.data);
      };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return {
      start(ms, fn) { worker.onmessage = fn; worker.postMessage(ms); },
      stop() { worker.postMessage(0); worker.onmessage = null; },
      dispose() { worker.terminate(); },
    };
  } catch {
    let id = null;
    return {
      start(ms, fn) { clearInterval(id); id = setInterval(fn, ms); },
      stop() { clearInterval(id); },
      dispose() { clearInterval(id); },
    };
  }
}

export class Countdown {
  /**
   * @param {number} durationMs
   * @param {{onTick?: (c: Countdown) => void, onDone?: () => void, tickMs?: number}} opts
   */
  constructor(durationMs, { onTick, onDone, tickMs = 200 } = {}) {
    this.duration = durationMs;
    this.onTick = onTick;
    this.onDone = onDone;
    this.tickMs = tickMs;
    this.ticker = makeTicker();
    this.endAt = 0;
    this.left = durationMs;
    this.running = false;
    this.done = false;
    this.startedAt = 0;
  }

  start() {
    this.startedAt = performance.now();
    this.resume();
  }

  resume() {
    if (this.running || this.done) return;
    this.running = true;
    this.endAt = performance.now() + this.left;
    this.ticker.start(this.tickMs, () => this._tick());
    this._tick();
  }

  pause() {
    if (!this.running) return;
    this.left = this.remaining;
    this.running = false;
    this.ticker.stop();
    this.onTick?.(this);
  }

  /** Stop for good and release the worker. */
  stop() {
    this.left = this.remaining;
    this.running = false;
    this.ticker.dispose();
  }

  get remaining() {
    return this.running ? Math.max(0, this.endAt - performance.now()) : this.left;
  }

  get elapsed() {
    return this.duration - this.remaining;
  }

  /** 0 → 1 as time runs out. */
  get progress() {
    return this.duration ? Math.min(1, this.elapsed / this.duration) : 1;
  }

  _tick() {
    if (!this.running) return;
    this.onTick?.(this);
    if (this.remaining <= 0) {
      this.running = false;
      this.done = true;
      this.left = 0;
      this.ticker.dispose();
      this.onDone?.();
    }
  }
}

/** Format milliseconds as m:ss (rounding up, like a real countdown). */
export function fmtClock(ms, { ceil = true } = {}) {
  const total = Math.max(0, ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Repeating callback on the (unthrottled) worker ticker. */
export function every(ms, fn) {
  const t = makeTicker();
  t.start(ms, fn);
  return () => t.dispose();
}
