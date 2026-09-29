/*
 * Local, offline speech analysis. Pure functions — no DOM, no network.
 */
import { PACE_BANDS } from './config.js';

// Words, contractions ("isn't") and numbers with decimals/thousands ("0.1", "44,100").
const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+|(?<=\p{N})[.,]\p{N}+)*/gu;

const norm = (w) => w.toLowerCase().replace(/’/g, "'");

/** Split text into word tokens, keeping their offsets in the original string. */
export function tokenize(text) {
  const out = [];
  for (const m of text.matchAll(WORD_RE)) {
    out.push({ word: norm(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function normaliseFillers(list) {
  return list
    .map((f) => (typeof f === 'string' ? { phrase: f } : f))
    .map((f) => ({
      phrase: f.phrase.toLowerCase().trim(),
      parts: tokenize(f.phrase).map((t) => t.word),
      ignoreAfter: new Set((f.ignoreAfter || []).map(norm)),
    }))
    .filter((f) => f.parts.length)
    // Longer phrases first so "you know" isn't also counted as something shorter.
    .sort((a, b) => b.parts.length - a.parts.length);
}

/**
 * Count filler words/phrases.
 * Returns { total, counts: [{phrase, count}], hits: [{start, end, phrase}] }
 * where start/end are character offsets into the original text.
 */
export function countFillers(text, fillerList) {
  const tokens = tokenize(text);
  const fillers = normaliseFillers(fillerList);
  const used = new Array(tokens.length).fill(false);
  const counts = new Map();
  const hits = [];

  for (const f of fillers) {
    const n = f.parts.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      let match = true;
      for (let k = 0; k < n; k++) {
        if (used[i + k] || tokens[i + k].word !== f.parts[k]) { match = false; break; }
      }
      if (!match) continue;
      if (i > 0 && f.ignoreAfter.has(tokens[i - 1].word)) continue;
      for (let k = 0; k < n; k++) used[i + k] = true;
      counts.set(f.phrase, (counts.get(f.phrase) || 0) + 1);
      hits.push({ start: tokens[i].start, end: tokens[i + n - 1].end, phrase: f.phrase });
      i += n - 1;
    }
  }

  hits.sort((a, b) => a.start - b.start);
  const list = [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
  return { total: hits.length, counts: list, hits };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Voice-activity based pause detection from microphone level samples.
 * samples: [{ t: ms since speech start, db: dBFS level }]
 * Returns null when the signal is too flat to separate speech from silence.
 */
export function analysePausesFromLevels(samples, durationMs, opts = {}) {
  const { minGapMs = 250, minBlipMs = 120, minPauseMs = 400 } = opts;
  if (!samples || samples.length < 20) return null;

  const dbs = samples.map((s) => s.db).filter(Number.isFinite).sort((a, b) => a - b);
  const floor = percentile(dbs, 0.1);
  const peak = percentile(dbs, 0.95);
  const range = peak - floor;
  if (range < 10) return null;
  const threshold = floor + Math.max(6, range * 0.3);

  // Build speech/silence runs.
  const runs = [];
  for (let i = 0; i < samples.length; i++) {
    const speaking = samples[i].db > threshold;
    const t = samples[i].t;
    const next = i + 1 < samples.length ? samples[i + 1].t : Math.max(t, durationMs);
    const last = runs[runs.length - 1];
    if (last && last.speaking === speaking) last.end = next;
    else runs.push({ speaking, start: t, end: next });
  }

  // Smooth: drop speech blips (clicks, bumps) then fill short gaps between syllables.
  const merge = (list) => {
    const out = [];
    for (const r of list) {
      const last = out[out.length - 1];
      if (last && last.speaking === r.speaking) last.end = r.end;
      else out.push({ ...r });
    }
    return out;
  };
  let smooth = merge(runs.map((r) => (r.speaking && r.end - r.start < minBlipMs ? { ...r, speaking: false } : r)));
  smooth = merge(smooth.map((r, i) => {
    const inner = i > 0 && i < smooth.length - 1;
    return !r.speaking && inner && r.end - r.start < minGapMs ? { ...r, speaking: true } : r;
  }));

  const speech = smooth.filter((r) => r.speaking);
  if (!speech.length) return null;
  const firstSpeech = speech[0].start;
  const lastSpeech = speech[speech.length - 1].end;

  const pauses = smooth
    .filter((r) => !r.speaking && r.start >= firstSpeech && r.end <= lastSpeech)
    .map((r) => ({ start: r.start, end: r.end, duration: r.end - r.start }))
    .filter((p) => p.duration >= minPauseMs);

  const longest = pauses.reduce((best, p) => (!best || p.duration > best.duration ? p : best), null);
  return {
    source: 'audio',
    threshold,
    floor,
    peak,
    firstSpeech,
    lastSpeech,
    pauses,
    longest,
    runs: smooth,
  };
}

/**
 * Fallback pause detection from recogniser result timestamps.
 * events: [{ t, words }] — one per recognition result event.
 */
export function analysePausesFromEvents(events, durationMs, opts = {}) {
  const { minPauseMs = 1200 } = opts;
  const active = events.filter((e, i) => i === 0 || e.words !== events[i - 1].words);
  if (!active.length) return null;
  // Recognition results trail the audio by roughly half a second.
  const lag = 500;
  const pauses = [];
  for (let i = 1; i < active.length; i++) {
    const gap = active[i].t - active[i - 1].t;
    if (gap >= minPauseMs) {
      const start = Math.max(0, active[i - 1].t - lag);
      pauses.push({ start, end: start + gap - lag, duration: gap - lag });
    }
  }
  const longest = pauses.reduce((best, p) => (!best || p.duration > best.duration ? p : best), null);
  return {
    source: 'recognition',
    firstSpeech: Math.max(0, active[0].t - 900),
    lastSpeech: Math.min(durationMs, active[active.length - 1].t),
    pauses,
    longest,
    runs: null,
  };
}

/** Words-per-minute per time bucket, from a running word count. */
export function paceBuckets(events, durationMs, bucketMs = 10000) {
  const buckets = [];
  let runningMax = 0;
  const maxAt = [];
  for (const e of events) {
    runningMax = Math.max(runningMax, e.words);
    maxAt.push({ t: e.t, words: runningMax });
  }
  const wordsBy = (t) => {
    let w = 0;
    for (const e of maxAt) { if (e.t <= t) w = e.words; else break; }
    return w;
  };
  const n = Math.max(1, Math.ceil(durationMs / bucketMs));
  for (let i = 0; i < n; i++) {
    const a = i * bucketMs;
    const b = Math.min(durationMs, a + bucketMs);
    const words = Math.max(0, wordsBy(b) - wordsBy(a));
    const span = (b - a) / 60000;
    buckets.push({ start: a, end: b, words, wpm: span > 0 ? Math.round(words / span) : 0 });
  }
  return buckets;
}

export function paceBand(wpm) {
  return PACE_BANDS.find((b) => wpm < b.max) || PACE_BANDS[PACE_BANDS.length - 1];
}

export function fillerRating(perMin) {
  if (perMin <= 2) return { label: 'Clean', tone: 'good' };
  if (perMin <= 5) return { label: 'A few', tone: 'ok' };
  if (perMin <= 8) return { label: 'Noticeable', tone: 'warn' };
  return { label: 'Heavy', tone: 'bad' };
}

export function pauseRating(ms) {
  if (ms == null) return { label: 'Seamless', tone: 'good' };
  if (ms < 1500) return { label: 'Smooth', tone: 'good' };
  if (ms < 3000) return { label: 'Deliberate', tone: 'good' };
  if (ms < 5000) return { label: 'Noticeable', tone: 'warn' };
  return { label: 'Too long', tone: 'bad' };
}

/**
 * Run the full analysis.
 * input: { transcript, durationMs, levels: [{t, db}], events: [{t, words}], fillers }
 */
export function analyseSpeech({ transcript, durationMs, levels, events, fillers }) {
  const tokens = tokenize(transcript);
  const wordCount = tokens.length;
  const fill = countFillers(transcript, fillers);

  const pauses =
    analysePausesFromLevels(levels, durationMs) ||
    analysePausesFromEvents(events, durationMs) ||
    { source: 'none', firstSpeech: 0, lastSpeech: durationMs, pauses: [], longest: null, runs: null };

  // Pace is measured over the time you were actually talking (first sound to last),
  // so a slow start or finishing a few seconds early doesn't skew it.
  let speakingMs = pauses.lastSpeech - pauses.firstSpeech;
  if (!(speakingMs > 3000) || speakingMs > durationMs) speakingMs = durationMs;
  const speakingMin = Math.max(speakingMs, 1000) / 60000;
  const wpm = wordCount ? Math.round(wordCount / speakingMin) : 0;
  const fillersPerMin = wordCount ? fill.total / speakingMin : 0;
  const longPauses = pauses.pauses.filter((p) => p.duration >= 2000).length;

  return {
    transcript,
    wordCount,
    durationMs,
    speakingMs,
    wpm,
    pace: paceBand(wpm),
    fillers: fill,
    fillersPerMin,
    fillerRating: fillerRating(fillersPerMin),
    pauses,
    longestPauseMs: pauses.longest ? pauses.longest.duration : null,
    longPauses,
    pauseRating: pauseRating(pauses.longest ? pauses.longest.duration : null),
    timeToFirstWordMs: pauses.source === 'none' ? null : pauses.firstSpeech,
    paceBuckets: paceBuckets(events, durationMs),
  };
}
