/*
 * Results graphics: pace gauge, speech timeline, filler breakdown.
 * All hand-rolled SVG so there are no dependencies.
 */
import { IDEAL_WPM, PACE_BANDS } from './config.js';
import { esc, reducedMotion } from './visuals.js';
import { fmtClock } from './timer.js';

const TONE = {
  good: 'var(--good)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
};

/* ───────────── Pace gauge ───────────── */

const G_MIN = 60, G_MAX = 220;

function gaugeAngle(v) {
  const t = (Math.min(G_MAX, Math.max(G_MIN, v)) - G_MIN) / (G_MAX - G_MIN);
  return -90 + t * 180;
}

function gArc(r, v0, v1) {
  const a0 = ((gaugeAngle(v0) - 90) * Math.PI) / 180;
  const a1 = ((gaugeAngle(v1) - 90) * Math.PI) / 180;
  const x0 = 100 + r * Math.cos(a0), y0 = 100 + r * Math.sin(a0);
  const x1 = 100 + r * Math.cos(a1), y1 = 100 + r * Math.sin(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function renderGauge(el, wpm) {
  let lo = G_MIN;
  const zones = PACE_BANDS.map((b) => {
    const hi = Math.min(G_MAX, b.max);
    const z = lo < hi ? `<path d="${gArc(78, lo + 0.8, hi - 0.8)}" style="stroke:${TONE[b.tone]}" class="gauge-zone"/>` : '';
    lo = hi;
    return z;
  }).join('');
  const ticks = [];
  for (let v = G_MIN; v <= G_MAX; v += 20) {
    const a = ((gaugeAngle(v) - 90) * Math.PI) / 180;
    const major = v % 40 === 0;
    const x0 = 100 + 66 * Math.cos(a), y0 = 100 + 66 * Math.sin(a);
    const x1 = 100 + (major ? 60 : 63) * Math.cos(a), y1 = 100 + (major ? 60 : 63) * Math.sin(a);
    ticks.push(`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="gauge-tick"/>`);
    if (major && v !== G_MIN && v !== G_MAX) {
      const tx = 100 + 51 * Math.cos(a), ty = 100 + 51 * Math.sin(a);
      ticks.push(`<text x="${tx.toFixed(1)}" y="${(ty + 2.5).toFixed(1)}" class="gauge-num">${v}</text>`);
    }
  }
  el.innerHTML = `
    <svg viewBox="0 0 200 108" class="gauge" aria-hidden="true">
      <path d="${gArc(78, G_MIN, G_MAX)}" class="gauge-track"/>
      ${zones}
      <path d="${gArc(88, IDEAL_WPM[0], IDEAL_WPM[1])}" class="gauge-ideal"/>
      ${ticks.join('')}
      <g class="gauge-needle" style="transform: rotate(-90deg)">
        <line x1="100" y1="100" x2="100" y2="30"/>
        <circle cx="100" cy="30" r="2.6"/>
      </g>
      <circle cx="100" cy="100" r="5" class="gauge-hub"/>
    </svg>`;
  const needle = el.querySelector('.gauge-needle');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    needle.style.transform = `rotate(${gaugeAngle(wpm)}deg)`;
  }));
}

/* ───────────── Speech timeline ───────────── */

/**
 * Waveform-style level history with pauses shaded, plus pace columns
 * on the same time axis underneath.
 */
export function renderTimeline(el, stats, levels, events, { animate = true } = {}) {
  const W = Math.max(320, Math.round(el.clientWidth || 800));
  const H = 196;
  const padL = 8, padR = 8;
  const dur = Math.max(1000, stats.durationMs);
  const x = (t) => padL + (Math.min(dur, Math.max(0, t)) / dur) * (W - padL - padR);
  const waveMid = 68, waveAmp = 42;
  const paceTop = 126, paceH = 44;

  // Level bars (or recognition activity when audio levels aren't usable).
  const barW = 4, gap = 2;
  const nBars = Math.floor((W - padL - padR) / (barW + gap));
  const binMs = dur / nBars;
  const values = new Array(nBars).fill(0);
  const p = stats.pauses;
  if (p.source === 'audio' && levels.length) {
    const counts = new Array(nBars).fill(0);
    for (const s of levels) {
      const i = Math.min(nBars - 1, Math.floor(s.t / binMs));
      if (i < 0) continue;
      values[i] += s.db; counts[i]++;
    }
    for (let i = 0; i < nBars; i++) {
      const db = counts[i] ? values[i] / counts[i] : p.floor;
      values[i] = Math.max(0, Math.min(1, (db - p.floor) / (p.peak - p.floor)));
    }
  } else if (events.length) {
    let prev = 0;
    for (const e of events) {
      const i = Math.min(nBars - 1, Math.floor(e.t / binMs));
      const d = Math.max(0, e.words - prev);
      prev = Math.max(prev, e.words);
      if (i >= 0) values[i] += d;
    }
    const max = Math.max(1, ...values);
    for (let i = 0; i < nBars; i++) values[i] = Math.min(1, values[i] / max + (values[i] ? 0.15 : 0));
  }
  const inPause = (t) => p.pauses.some((q) => t >= q.start && t <= q.end);
  const umSpans = stats.likelyUms ? stats.likelyUms.spans : [];
  const inUm = (t) => umSpans.some((q) => t >= q.start && t <= q.end);
  const bars = values.map((v, i) => {
    const h = Math.max(1.5, v * waveAmp);
    const bx = padL + i * (barW + gap);
    const t = (i + 0.5) * binMs;
    const quiet = inPause(t) || t < p.firstSpeech || t > p.lastSpeech;
    const um = !quiet && inUm(t);
    const delay = reducedMotion() ? 0 : Math.round(i * 5);
    return `<rect x="${bx}" y="${(waveMid - h).toFixed(1)}" width="${barW}" height="${(h * 2).toFixed(1)}" rx="2" class="tl-bar${quiet ? ' quiet' : um ? ' um' : ''}" style="animation-delay:${delay}ms"/>`;
  }).join('');

  const pauseRects = p.pauses.map((q) => {
    const longest = p.longest && q.start === p.longest.start;
    const x0 = x(q.start), x1 = x(q.end);
    return `<rect x="${x0.toFixed(1)}" y="${waveMid - waveAmp - 4}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${waveAmp * 2 + 8}" rx="6" class="tl-pause${longest ? ' longest' : ''}"/>`;
  }).join('');

  let longestLabel = '';
  if (p.longest) {
    const cx = (x(p.longest.start) + x(p.longest.end)) / 2;
    const label = `${(p.longest.duration / 1000).toFixed(1)}s pause`;
    const lw = label.length * 6.4 + 16;
    const lx = Math.min(W - padR - lw, Math.max(padL, cx - lw / 2));
    longestLabel = `
      <g class="tl-flag">
        <rect x="${lx.toFixed(1)}" y="0" width="${lw.toFixed(1)}" height="18" rx="9"/>
        <text x="${(lx + lw / 2).toFixed(1)}" y="12.5">${label}</text>
      </g>`;
  }

  // Pace columns.
  const idealLo = paceTop + paceH - (IDEAL_WPM[0] / G_MAX) * paceH;
  const idealHi = paceTop + paceH - (IDEAL_WPM[1] / G_MAX) * paceH;
  const pace = stats.paceBuckets.map((b, i) => {
    if (b.end - b.start < 3000) return '';
    const x0 = x(b.start) + 3, x1 = x(b.end) - 3;
    const h = Math.max(2, Math.min(1, b.wpm / G_MAX) * paceH);
    const y = paceTop + paceH - h;
    const band = PACE_BANDS.find((z) => b.wpm < z.max);
    const tone = b.words === 0 ? 'var(--muted-2)' : TONE[band.tone];
    const delay = reducedMotion() ? 0 : 300 + i * 90;
    return `
      <g class="tl-pace" style="animation-delay:${delay}ms">
        <rect x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="fill:${tone}" class="tl-pace-fill"/>
        <line x1="${x0.toFixed(1)}" x2="${x1.toFixed(1)}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke:${tone}" class="tl-pace-cap"/>
      </g>
      <text x="${((x0 + x1) / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" class="tl-pace-num" style="animation-delay:${delay + 200}ms">${b.words ? `${b.wpm} wpm` : '–'}</text>`;
  }).join('');

  const axis = [];
  for (let t = 0; t <= dur + 1; t += 10000) {
    axis.push(`<text x="${x(t).toFixed(1)}" y="${H - 4}" class="tl-axis" text-anchor="${t === 0 ? 'start' : t >= dur - 500 ? 'end' : 'middle'}">${fmtClock(t, { ceil: false })}</text>`);
    axis.push(`<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${paceTop + paceH + 3}" y2="${paceTop + paceH + 8}" class="tl-tick"/>`);
  }

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="timeline${animate ? '' : ' static'}" role="img" aria-label="Speech timeline">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="tl-hatch"/>
        </pattern>
      </defs>
      <line x1="${padL}" x2="${W - padR}" y1="${waveMid}" y2="${waveMid}" class="tl-mid"/>
      ${pauseRects}
      ${bars}
      ${longestLabel}
      <line x1="${padL}" x2="${W - padR}" y1="${paceTop + paceH}" y2="${paceTop + paceH}" class="tl-base"/>
      ${pace}
      <rect x="${padL}" width="${W - padL - padR}" y="${idealHi.toFixed(1)}" height="${(idealLo - idealHi).toFixed(1)}" class="tl-ideal"/>
      <line x1="${padL}" x2="${W - padR}" y1="${idealHi.toFixed(1)}" y2="${idealHi.toFixed(1)}" class="tl-ideal-edge"/>
      <line x1="${padL}" x2="${W - padR}" y1="${idealLo.toFixed(1)}" y2="${idealLo.toFixed(1)}" class="tl-ideal-edge"/>
      <text x="${padL + 2}" y="${(idealLo + 11).toFixed(1)}" class="tl-ideal-label">ideal ${IDEAL_WPM[0]}–${IDEAL_WPM[1]} wpm</text>
      ${axis.join('')}
    </svg>`;
}

/* ───────────── Filler breakdown ───────────── */

export function renderFillerBars(el, fillers) {
  if (!fillers.total) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l4.9 13.6L43 19l-11 9.2L35.6 43 24 35.3 12.4 43 16 28.2 5 19l14.1-1.4z"/></svg>
        <p>No filler words in the transcript.<br><span>Crisp.</span></p>
      </div>`;
    return;
  }
  const max = fillers.counts[0].count;
  el.innerHTML = fillers.counts.map((f, i) => `
    <div class="fbar${f.possible ? ' possible' : ''}" style="--d:${reducedMotion() ? 0 : 200 + i * 80}ms">
      <span class="fbar-label">“${esc(f.phrase)}”${f.possible ? ' <em class="possible-tag">possible</em>' : ''}</span>
      <span class="fbar-track"><span class="fbar-fill" style="--w:${((f.count / max) * 100).toFixed(1)}%"></span></span>
      <span class="fbar-count">${f.count}</span>
    </div>`).join('');
}

/* ───────────── Transcript with highlighted fillers ───────────── */

export function transcriptHTML(text, hits) {
  if (!text) return '<p class="muted">No speech was recognised. Check your microphone and try again.</p>';
  let html = '';
  let pos = 0;
  for (const h of hits) {
    html += esc(text.slice(pos, h.start));
    html += `<mark class="filler${h.possible ? ' possible' : ''}" title="${h.possible ? 'possible filler' : 'filler'}: ${esc(h.phrase)}">${esc(text.slice(h.start, h.end))}</mark>`;
    pos = h.end;
  }
  html += esc(text.slice(pos));
  return `<p>${html}</p>`;
}

/* ───────────── Mini graphics for the stat cards ───────────── */

/** Cumulative word count over time. */
export function renderWordSpark(el, events, durationMs) {
  const W = 200, H = 44;
  const dur = Math.max(1000, durationMs);
  let max = 0;
  const pts = [[0, H - 2]];
  let top = 0;
  for (const e of events) top = Math.max(top, e.words);
  for (const e of events) {
    max = Math.max(max, e.words);
    const x = (Math.min(dur, e.t) / dur) * W;
    const y = H - 2 - (top ? (max / top) * (H - 6) : 0);
    pts.push([x, y]);
  }
  pts.push([W, pts[pts.length - 1][1]]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="spark" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/>
          <stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient>
      </defs>
      <path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#spark-fill)" class="spark-area"/>
      <path d="${line}" pathLength="1" class="spark-line"/>
    </svg>`;
}

/** One dot per filler word, like tally marks. */
export function renderFillerDots(el, total) {
  const n = Math.min(total, 36);
  el.innerHTML = n
    ? Array.from({ length: n }, (_, i) => `<i style="animation-delay:${reducedMotion() ? 0 : 250 + i * 45}ms"></i>`).join('') +
      (total > n ? `<span>+${total - n}</span>` : '')
    : '<span class="dots-none">none caught</span>';
}

/** Pauses laid out along the speech. */
export function renderPauseStrip(el, stats) {
  const dur = Math.max(1000, stats.durationMs);
  const p = stats.pauses;
  const seg = (a, b, cls, i) =>
    `<span class="${cls}" style="left:${((a / dur) * 100).toFixed(2)}%;width:${Math.max(0.6, ((b - a) / dur) * 100).toFixed(2)}%;animation-delay:${reducedMotion() ? 0 : 300 + i * 60}ms"></span>`;
  const speech = p.source === 'none' ? '' : seg(p.firstSpeech, p.lastSpeech, 'ps-speech', 0);
  const pauses = p.pauses
    .map((q, i) => seg(q.start, q.end, p.longest && q.start === p.longest.start ? 'ps-pause longest' : 'ps-pause', i + 1))
    .join('');
  el.innerHTML = `<div class="ps-track">${speech}${pauses}</div>`;
}
