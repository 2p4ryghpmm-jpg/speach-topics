/*
 * Visual components: starfield background, category wheel, timer dials,
 * the radial voice visualiser, text reveal effects and the live favicon.
 */
import { CATEGORIES } from './config.js';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SVGNS = 'http://www.w3.org/2000/svg';

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ───────────────────────── Starfield ───────────────────────── */

export function startStarfield(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let stars = [];
  let shooting = null;
  let mouseX = 0, mouseY = 0, px = 0, py = 0;
  let tint = [255, 255, 255];

  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const count = Math.round(Math.min(160, (w * h) / 11000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.1 + 0.25,
      tw: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.6 + 0.2,
      tinted: Math.random() < 0.28,
    }));
  };
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / w - 0.5) * 2;
    mouseY = (e.clientY / h - 0.5) * 2;
  });

  const still = reducedMotion();
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(64, now - last); last = now;
    px += (mouseX - px) * 0.03; py += (mouseY - py) * 0.03;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!still) {
        s.y -= s.z * 0.006 * dt;
        s.x += s.z * 0.002 * dt;
        if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
        if (s.x > w + 4) s.x = -4;
      }
      const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * s.sp + s.tw);
      const x = s.x - px * 14 * s.z;
      const y = s.y - py * 10 * s.z;
      const [r, g, b] = s.tinted ? tint : [220, 225, 255];
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.12 + 0.5 * s.z) * tw})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r * s.z * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // An occasional shooting star, rare enough to be a nice surprise.
    if (!still && !shooting && Math.random() < 0.0009) {
      shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.35, life: 0 };
    }
    if (shooting) {
      shooting.life += dt;
      const t = shooting.life / 900;
      const sx = shooting.x + t * 380, sy = shooting.y + t * 160;
      const grad = ctx.createLinearGradient(sx - 90, sy - 38, sx, sy);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, `rgba(255,255,255,${0.55 * (1 - t)})`);
      ctx.strokeStyle = grad; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx - 90, sy - 38); ctx.lineTo(sx, sy); ctx.stroke();
      if (t >= 1) shooting = null;
    }
    raf = requestAnimationFrame(frame);
  };
  let raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  return {
    setTint(hex) {
      const n = parseInt(hex.slice(1), 16);
      tint = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
  };
}

/* ───────────────────────── Category wheel ───────────────────────── */

const CX = 120, CY = 120, RING_R = 92;

function polar(r, deg, cx = CX, cy = CY) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(r, a0, a1, reverse = false, cx = CX, cy = CY) {
  const [x0, y0] = polar(r, a0, cx, cy);
  const [x1, y1] = polar(r, a1, cx, cy);
  const large = a1 - a0 > 180 ? 1 : 0;
  return reverse
    ? `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 0 ${x0.toFixed(2)} ${y0.toFixed(2)}`
    : `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const GLYPHS = {
  idle: `
    <svg viewBox="0 0 100 100" class="glyph glyph-idle">
      <circle cx="50" cy="50" r="22" class="g-faint"/>
      <g class="g-orbit">
        <circle cx="50" cy="28" r="4.2" fill="${CATEGORIES.physics.color}"/>
        <circle cx="69.05" cy="61" r="4.2" fill="${CATEGORIES.cs.color}"/>
        <circle cx="30.95" cy="61" r="4.2" fill="${CATEGORIES.general.color}"/>
      </g>
      <circle cx="50" cy="50" r="2.2" class="g-fill"/>
    </svg>`,
  physics: `
    <svg viewBox="0 0 100 100" class="glyph">
      <g class="g-spin-slow">
        <ellipse cx="50" cy="50" rx="36" ry="13" class="g-line"/>
        <ellipse cx="50" cy="50" rx="36" ry="13" class="g-line" transform="rotate(60 50 50)"/>
        <ellipse cx="50" cy="50" rx="36" ry="13" class="g-line" transform="rotate(120 50 50)"/>
        <circle r="3" class="g-fill g-glow"><animateMotion dur="2.4s" repeatCount="indefinite" path="M14 50a36 13 0 1 0 72 0a36 13 0 1 0 -72 0"/></circle>
        <g transform="rotate(60 50 50)"><circle r="3" class="g-fill g-glow"><animateMotion dur="3.1s" repeatCount="indefinite" path="M86 50a36 13 0 1 0 -72 0a36 13 0 1 0 72 0"/></circle></g>
        <g transform="rotate(120 50 50)"><circle r="3" class="g-fill g-glow"><animateMotion dur="2.7s" repeatCount="indefinite" path="M14 50a36 13 0 1 1 72 0a36 13 0 1 1 -72 0"/></circle></g>
      </g>
      <circle cx="50" cy="50" r="6" class="g-fill g-pulse"/>
    </svg>`,
  cs: `
    <svg viewBox="0 0 100 100" class="glyph">
      <g class="g-line">
        <path d="M50 8v16M36 12v12M64 12v12M50 92V76M36 88V76M64 88V76M8 50h16M12 36h12M12 64h12M92 50H76M88 36H76M88 64H76"/>
      </g>
      <g class="g-trace">
        <path d="M50 8v16M36 12v12M64 12v12M50 92V76M36 88V76M64 88V76M8 50h16M12 36h12M12 64h12M92 50H76M88 36H76M88 64H76"/>
      </g>
      <rect x="25" y="25" width="50" height="50" rx="8" class="g-line g-chip"/>
      <rect x="36" y="36" width="28" height="28" rx="4" class="g-fill g-pulse" opacity=".9"/>
      <text x="50" y="54.5" text-anchor="middle" class="g-bits">01</text>
    </svg>`,
  general: `
    <svg viewBox="0 0 100 100" class="glyph">
      <path id="lemni" d="M50 50 C 62 34, 86 34, 86 50 C 86 66, 62 66, 50 50 C 38 34, 14 34, 14 50 C 14 66, 38 66, 50 50 Z" class="g-line"/>
      <path d="M50 50 C 62 34, 86 34, 86 50 C 86 66, 62 66, 50 50 C 38 34, 14 34, 14 50 C 14 66, 38 66, 50 50 Z" pathLength="100" class="g-trace-inf"/>
      <circle r="3.4" class="g-fill g-glow"><animateMotion dur="3.6s" repeatCount="indefinite" rotate="auto"><mpath href="#lemni"/></animateMotion></circle>
    </svg>`,
};

export class Wheel {
  constructor(root) {
    this.root = root;
    this.svg = root.querySelector('svg');
    this.rotor = root.querySelector('.wheel-rotor');
    this.core = root.querySelector('.wheel-core');
    this.angle = 0;
    this.segments = {};
    this.build();
    this.setGlyph('idle', true);
  }

  build() {
    const arcs = this.svg.querySelector('.wheel-arcs');
    const labels = this.svg.querySelector('.wheel-labels');
    const ticks = this.svg.querySelector('.wheel-ticks');
    const defs = this.svg.querySelector('defs');
    const total = Object.values(CATEGORIES).reduce((s, c) => s + c.weight, 0);
    let a = 0;
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      const span = (cat.weight / total) * 360;
      const seg = { key, start: a, end: a + span };
      this.segments[key] = seg;

      const glow = document.createElementNS(SVGNS, 'path');
      glow.setAttribute('d', arcPath(RING_R, a + 1.8, a + span - 1.8));
      glow.setAttribute('class', 'wheel-arc-glow');
      glow.setAttribute('stroke', cat.color);
      glow.dataset.cat = key;
      arcs.appendChild(glow);

      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', arcPath(RING_R, a + 1.8, a + span - 1.8));
      p.setAttribute('class', 'wheel-arc');
      p.setAttribute('stroke', cat.color);
      p.dataset.cat = key;
      arcs.appendChild(p);

      const mid = a + span / 2;
      const bottom = mid > 90 && mid < 270;
      const lp = document.createElementNS(SVGNS, 'path');
      lp.setAttribute('id', `wl-${key}`);
      lp.setAttribute('d', arcPath(bottom ? 110 : 104, a, a + span, bottom));
      lp.setAttribute('fill', 'none');
      defs.appendChild(lp);
      const text = document.createElementNS(SVGNS, 'text');
      text.setAttribute('class', 'wheel-label');
      text.dataset.cat = key;
      text.innerHTML = `<textPath href="#wl-${key}" startOffset="50%" text-anchor="middle">${esc(cat.label.toUpperCase())} · ${cat.weight}%</textPath>`;
      labels.appendChild(text);
      a += span;
    }
    let tickSvg = '';
    for (let i = 0; i < 72; i++) {
      const [x0, y0] = polar(82, i * 5);
      const [x1, y1] = polar(i % 6 === 0 ? 78 : 80, i * 5);
      tickSvg += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`;
    }
    ticks.innerHTML = tickSvg;
  }

  setGlyph(key, instant = false) {
    const old = this.core.querySelector('.glyph-wrap:not(.leaving)');
    const wrap = document.createElement('div');
    wrap.className = 'glyph-wrap' + (instant ? '' : ' entering');
    wrap.dataset.glyph = key;
    wrap.innerHTML = GLYPHS[key];
    this.core.appendChild(wrap);
    if (old) {
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 500);
    }
  }

  highlight(key) {
    this.svg.querySelectorAll('[data-cat]').forEach((el) => {
      el.classList.toggle('active', key != null && el.dataset.cat === key);
      el.classList.toggle('dim', key != null && el.dataset.cat !== key);
    });
    if (key) {
      const ripple = this.root.querySelector('.wheel-ripple');
      ripple.style.setProperty('--ripple', CATEGORIES[key].color);
      ripple.classList.remove('go');
      void ripple.offsetWidth;
      ripple.classList.add('go');
    }
  }

  /** Spin the comet and land inside the given category's arc. */
  async spin(key) {
    const seg = this.segments[key];
    const margin = Math.min(10, (seg.end - seg.start) * 0.15);
    const land = seg.start + margin + Math.random() * (seg.end - seg.start - margin * 2);
    const from = this.angle;
    const base = from - (from % 360);
    const turns = reducedMotion() ? 0 : 3;
    let to = base + turns * 360 + land;
    if (to - from < 200 && !reducedMotion()) to += 360;
    this.angle = to;
    this.highlight(null);
    this.root.classList.add('spinning', 'has-spun');
    const duration = reducedMotion() ? 300 : 2600;
    const anim = this.rotor.animate(
      [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }],
      { duration, easing: 'cubic-bezier(0.12, 0.72, 0.18, 1)', fill: 'forwards' }
    );
    await anim.finished;
    this.rotor.style.transform = `rotate(${to}deg)`;
    anim.cancel();
    this.root.classList.remove('spinning');
    this.highlight(key);
    this.setGlyph(key);
  }
}

/* ───────────────────────── Timer dial ───────────────────────── */

const DIAL_R = 118;
const DIAL_C = 2 * Math.PI * DIAL_R;

export class Dial {
  constructor(root, { viz = false } = {}) {
    this.root = root;
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const [x0, y0] = polar(138, i * 6, 150, 150);
      const [x1, y1] = polar(major ? 128 : 132, i * 6, 150, 150);
      ticks += `<line data-i="${i}" class="${major ? 'major' : ''}" x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`;
    }
    root.innerHTML = `
      ${viz ? '<canvas class="dial-viz"></canvas>' : ''}
      <svg viewBox="0 0 300 300" class="dial-svg" aria-hidden="true">
        <circle class="dial-halo" cx="150" cy="150" r="104"/>
        <g class="dial-ticks">${ticks}</g>
        <circle class="dial-track" cx="150" cy="150" r="${DIAL_R}"/>
        <circle class="dial-arc-glow" cx="150" cy="150" r="${DIAL_R}"/>
        <circle class="dial-arc" cx="150" cy="150" r="${DIAL_R}"/>
        <circle class="dial-head" r="5.5"/>
        <circle class="dial-burst" cx="150" cy="150" r="${DIAL_R}"/>
      </svg>
      <div class="dial-center">
        <div class="dial-time">0:00</div>
        <div class="dial-sub"></div>
      </div>`;
    this.arcs = root.querySelectorAll('.dial-arc, .dial-arc-glow');
    this.head = root.querySelector('.dial-head');
    this.ticks = [...root.querySelectorAll('.dial-ticks line')];
    this.timeEl = root.querySelector('.dial-time');
    this.subEl = root.querySelector('.dial-sub');
    this.canvas = root.querySelector('.dial-viz');
    this.lastTick = -1;
    this.setProgress(0);
  }

  /** progress: 0 (full) → 1 (empty). The arc is eaten clockwise, like a sweeping hand. */
  setProgress(p) {
    p = Math.min(1, Math.max(0, p));
    const len = DIAL_C * (1 - p);
    for (const a of this.arcs) {
      a.setAttribute('stroke-dasharray', `${len.toFixed(2)} ${DIAL_C.toFixed(2)}`);
      a.setAttribute('transform', `rotate(${(-90 + 360 * p).toFixed(3)} 150 150)`);
      a.style.opacity = p >= 1 ? 0 : '';
    }
    const [hx, hy] = polar(DIAL_R, 360 * p, 150, 150);
    this.head.setAttribute('cx', hx.toFixed(2));
    this.head.setAttribute('cy', hy.toFixed(2));
    this.head.style.opacity = p >= 1 || p <= 0 ? 0 : '';
    const cur = Math.min(59, Math.floor(p * 60));
    if (cur !== this.lastTick) {
      this.lastTick = cur;
      this.ticks.forEach((t, i) => {
        t.classList.toggle('spent', i < cur);
        t.classList.toggle('now', i === cur && p > 0 && p < 1);
      });
    }
  }

  setTime(text) {
    this.timeEl.classList.remove('pop');
    if (this.timeEl.textContent !== text) this.timeEl.textContent = text;
  }

  setSub(text) {
    if (this.subEl.textContent !== text) this.subEl.textContent = text;
  }

  setPhase(phase) {
    if (this.root.dataset.phase !== phase) this.root.dataset.phase = phase;
  }

  /** Big number pop used for the 3-2-1 countdown. */
  pop(text) {
    this.timeEl.textContent = text;
    this.timeEl.classList.remove('pop');
    void this.timeEl.offsetWidth;
    this.timeEl.classList.add('pop');
  }

  burst() {
    const b = this.root.querySelector('.dial-burst');
    b.classList.remove('go');
    void b.getBoundingClientRect();
    b.classList.add('go');
  }
}

/* ───────────────────────── Radial voice visualiser ───────────────────────── */

export class RadialViz {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.levels = new Float32Array(72);
    this.color = '#ffffff';
    this.energy = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = this.canvas.clientWidth;
    if (!size) return;
    if (this.canvas.width !== Math.round(size * dpr)) {
      this.canvas.width = this.canvas.height = Math.round(size * dpr);
    }
    this.dpr = dpr;
    this.size = size;
  }

  /** freq: Uint8Array from the analyser (or null for an idle "breathing" ring). */
  draw(freq, now, active = true) {
    this.resize();
    if (!this.size) return;
    const { ctx, levels } = this;
    const n = levels.length;
    const half = n / 2;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      // Mirror left/right so the halo is symmetric; low frequencies at the top.
      const k = i < half ? i : n - 1 - i;
      let v = 0;
      if (freq && active) {
        const lo = Math.floor(2 + Math.pow(k / half, 1.6) * 90);
        const hi = Math.max(lo + 1, Math.floor(2 + Math.pow((k + 1) / half, 1.6) * 90));
        let s = 0;
        for (let b = lo; b < hi && b < freq.length; b++) s += freq[b];
        v = s / (hi - lo) / 255;
        v = Math.pow(v, 1.7);
      }
      const idle = 0.04 + 0.025 * Math.sin(now * 0.002 + i * 0.5);
      const target = Math.max(v, idle);
      levels[i] += (target - levels[i]) * (target > levels[i] ? 0.5 : 0.12);
      sum += levels[i];
    }
    this.energy += (sum / n - this.energy) * 0.2;

    const s = this.size;
    const c = s / 2;
    const base = s * 0.378;
    const maxLen = s * 0.105;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);

    // Soft glow blob.
    const glow = ctx.createRadialGradient(c, c, base * 0.8, c, c, base + maxLen * 1.2);
    glow.addColorStop(0, hexA(this.color, 0));
    glow.addColorStop(0.5, hexA(this.color, 0.05 + this.energy * 0.35));
    glow.addColorStop(1, hexA(this.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);

    // Smooth outline through the bar tips.
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const a = (idx / n) * Math.PI * 2 - Math.PI / 2;
      const r = base + levels[idx] * maxLen * 0.9;
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = hexA(this.color, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, s * 0.0065);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const len = 2 + levels[i] * maxLen;
      const x0 = c + Math.cos(a) * base, y0 = c + Math.sin(a) * base;
      const x1 = c + Math.cos(a) * (base + len), y1 = c + Math.sin(a) * (base + len);
      ctx.strokeStyle = hexA(this.color, 0.25 + Math.min(0.75, levels[i] * 1.6));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }

  clear() {
    this.resize();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.levels.fill(0);
  }
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

/* ───────────────────────── Text effects ───────────────────────── */

/** Replace text with words that blur/rise in one after another. */
export function revealWords(el, text, { stagger = 38 } = {}) {
  el.classList.remove('out');
  const words = text.split(/\s+/);
  el.innerHTML = words
    .map((w, i) => `<span class="w" style="animation-delay:${reducedMotion() ? 0 : i * stagger}ms">${esc(w)}</span>`)
    .join(' ');
  el.setAttribute('aria-label', text);
}

export async function fadeOutText(el) {
  if (!el.textContent.trim()) return;
  el.classList.add('out');
  await wait(reducedMotion() ? 0 : 280);
}

/**
 * Slot-machine style label: flicks through items, slowing down,
 * and returns when `duration` ms have passed.
 */
export async function reel(el, items, duration) {
  if (reducedMotion() || !items.length) return;
  const start = performance.now();
  let i = Math.floor(Math.random() * items.length);
  while (performance.now() - start < duration - 120) {
    const t = (performance.now() - start) / duration;
    el.textContent = items[i++ % items.length];
    el.classList.remove('flick');
    void el.offsetWidth;
    el.classList.add('flick');
    await wait(45 + 260 * t * t * t);
  }
}

/** Animate a number from 0 up to its value. */
export function countUp(el, to, { duration = 1100, decimals = 0, suffix = '', delay = 0 } = {}) {
  if (reducedMotion()) { el.textContent = to.toFixed(decimals) + suffix; return; }
  const start = performance.now() + delay;
  el.textContent = (0).toFixed(decimals) + suffix;
  const step = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    const e = 1 - Math.pow(1 - t, 4);
    el.textContent = (to * e).toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ───────────────────────── Live favicon ───────────────────────── */

let faviconLink = null;
let faviconDefault = null;
const favCanvas = document.createElement('canvas');
favCanvas.width = favCanvas.height = 64;

/** Draw a progress ring into the tab icon so you can see the timer from another tab. */
export function setFaviconProgress(remainingFrac, color) {
  faviconLink ||= document.getElementById('favicon');
  faviconDefault ||= faviconLink.href;
  const c = favCanvas.getContext('2d');
  c.clearRect(0, 0, 64, 64);
  c.fillStyle = '#0b0c12';
  c.beginPath(); c.arc(32, 32, 31, 0, Math.PI * 2); c.fill();
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.lineWidth = 7;
  c.beginPath(); c.arc(32, 32, 22, 0, Math.PI * 2); c.stroke();
  if (remainingFrac > 0) {
    c.strokeStyle = color;
    c.beginPath();
    c.arc(32, 32, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingFrac);
    c.stroke();
  }
  faviconLink.type = 'image/png';
  faviconLink.href = favCanvas.toDataURL('image/png');
}

export function resetFavicon() {
  if (!faviconLink || !faviconDefault) return;
  faviconLink.type = 'image/svg+xml';
  faviconLink.href = faviconDefault;
}

/** Small PNG icon for notifications (they don't reliably render SVG). */
export function notificationIcon(color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b0c12';
  c.beginPath(); c.arc(64, 64, 64, 0, Math.PI * 2); c.fill();
  c.strokeStyle = color; c.lineWidth = 12; c.lineCap = 'round';
  c.beginPath(); c.arc(64, 64, 40, -Math.PI / 2, Math.PI * 1.5); c.stroke();
  c.fillStyle = color;
  c.beginPath(); c.arc(64, 24, 10, 0, Math.PI * 2); c.fill();
  return cv.toDataURL('image/png');
}
