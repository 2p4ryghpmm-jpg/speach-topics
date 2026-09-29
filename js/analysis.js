/*
 * Local, offline speech analysis. Pure functions — no DOM, no network.
 *
 * Three layers:
 *  1. Text fillers   — matched in the transcript, with context rules.
 *  2. Audio          — pauses, hesitations and "likely um/uh" estimated from
 *                      microphone levels, because Chrome deletes ums from the text.
 *  3. Patterns       — repeated sentence openers and a one-line tip.
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

/**
 * Join recognition segments into one transcript.
 * Returns the text and the character offset where each segment starts.
 */
export function joinSegments(segments) {
  let text = '';
  const offsets = [];
  for (const seg of segments || []) {
    const t = String(seg.text || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (text) text += ' ';
    offsets.push(text.length);
    text += t;
  }
  return { text, offsets };
}

/**
 * Token indices that begin a sentence: the first word, anything after . ? !,
 * and the first word of each recognition segment (Chrome closes a segment
 * when you pause, and rarely adds punctuation on desktop).
 */
export function sentenceStarts(text, tokens, startOffsets = []) {
  const starts = new Set();
  if (!tokens.length) return starts;
  starts.add(0);
  for (let i = 1; i < tokens.length; i++) {
    if (/[.?!]/.test(text.slice(tokens[i - 1].end, tokens[i].start))) starts.add(i);
  }
  const offsets = [...startOffsets].sort((a, b) => a - b);
  let j = 0;
  for (const off of offsets) {
    while (j < tokens.length && tokens[j].start < off) j++;
    if (j < tokens.length) starts.add(j);
  }
  return starts;
}

/* ───────────── Layer 1: text fillers ───────────── */

// "like" is a comparison or a verb after these words: "looks like", "I like", "would like".
const LIKE_NOT_AFTER = new Set([
  'look', 'looks', 'looked', 'looking', 'seem', 'seems', 'seemed', 'sound', 'sounds', 'sounded',
  'feel', 'feels', 'felt', 'behave', 'behaves', 'behaved', 'behaving', 'act', 'acts', 'acted',
  'something', 'anything', 'nothing', 'everything', 'things', 'stuff', 'exactly', 'just', 'much',
  'more', 'less', 'very', 'not', 'shaped', 'i', 'you', 'we', 'they', 'he', 'she', 'would',
  "i'd", "you'd", "we'd", "they'd", "don't", "didn't", "doesn't", 'do', 'does', 'did', 'to',
]);
// …and it introduces a noun phrase when followed by these: "like a wave", "like this", "like two".
const NOUN_PHRASE_START = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our',
  'their', 'some', 'any', 'each', 'every', 'all', 'both', 'one', 'two', 'three', 'four', 'five',
  'ten', 'hundred', 'thousand', 'million', 'me', 'him', 'us', 'them', 'it', 'someone', 'something',
  'anything', 'everything', 'people', 'most', 'many', 'other', 'another', 'what', 'how',
]);
// Words ending in "s" that aren't plural nouns (so "was like" can still be a filler).
const NOT_PLURAL = new Set(['was', 'is', 'has', 'does', 'this', 'his', 'its', 'us', 'yes', 'as', 'thus', 'plus', 'always', 'perhaps', 'sometimes', 'unless', 'whereas', 'across', 'less', 'guess']);

function isFillerLike(tokens, i) {
  const prev = tokens[i - 1]?.word;
  const next = tokens[i + 1]?.word;
  if (next === 'you' && tokens[i + 2]?.word === 'know') return true; // "like, you know"
  if (prev && LIKE_NOT_AFTER.has(prev)) return false;
  // "particles like electrons", "languages like Python": a plural noun before it.
  if (prev && /^[a-z]{3,}[^s]s$/.test(prev) && !NOT_PLURAL.has(prev)) return false;
  if (next && (NOUN_PHRASE_START.has(next) || /^\d/.test(next))) return false;
  return true;
}

function normaliseFillers(list) {
  return list
    .map((f) => (typeof f === 'string' ? { phrase: f } : f))
    .map((f) => ({
      phrase: f.phrase.toLowerCase().trim(),
      parts: tokenize(f.phrase).map((t) => t.word),
      ignoreAfter: new Set((f.ignoreAfter || []).map(norm)),
      when: f.when || null,
      possible: Boolean(f.possible),
    }))
    .filter((f) => f.parts.length)
    // Longer phrases first, so "okay so" is never also counted as "so".
    .sort((a, b) => b.parts.length - a.parts.length);
}

/**
 * Count filler words/phrases.
 * opts.startOffsets — character offsets where recognition segments begin
 * opts.pauseBefore  — token indices preceded by a pause of 0.3 s or more
 * Returns { total, possibleTotal, counts: [{phrase, count, possible}],
 *           hits: [{start, end, phrase, possible}] } (character offsets).
 */
export function countFillers(text, fillerList, { startOffsets = [], pauseBefore = new Set() } = {}) {
  const tokens = tokenize(text);
  const starts = sentenceStarts(text, tokens, startOffsets);
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
      if (f.when === 'opener' && !starts.has(i) && !pauseBefore.has(i)) continue;
      if (f.when === 'like' && !isFillerLike(tokens, i)) continue;
      for (let k = 0; k < n; k++) used[i + k] = true;
      const c = counts.get(f.phrase) || { phrase: f.phrase, count: 0, possible: f.possible };
      c.count++;
      counts.set(f.phrase, c);
      hits.push({ start: tokens[i].start, end: tokens[i + n - 1].end, phrase: f.phrase, possible: f.possible });
      i += n - 1;
    }
  }

  hits.sort((a, b) => a.start - b.start);
  const list = [...counts.values()].sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
  return {
    total: hits.length,
    possibleTotal: hits.filter((h) => h.possible).length,
    counts: list,
    hits,
  };
}

/* ───────────── Layer 3: sentence openers ───────────── */

// Natural ways to start a sentence that aren't worth flagging.
const OPENER_IGNORE = new Set(['the', 'a', 'an', 'it', 'this', 'that', 'there', 'i', 'we', 'you', 'they', 'he', 'she']);

/** Words that start 3+ sentences, e.g. [{ word: 'so', count: 5 }]. */
export function repeatedOpeners(text, startOffsets = [], { min = 3 } = {}) {
  const tokens = tokenize(text);
  const starts = sentenceStarts(text, tokens, startOffsets);
  const counts = new Map();
  for (const i of starts) {
    const w = tokens[i]?.word;
    if (!w || OPENER_IGNORE.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const flagged = [...counts.entries()]
    .filter(([, c]) => c >= min)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
  return { sentences: starts.size, flagged };
}

/* ───────────── Layer 2: audio ───────────── */

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Voice-activity detection from microphone level samples.
 * samples: [{ t: ms since speech start, db: speech-band level in dB }]
 * Returns null when the signal is too flat to separate speech from silence.
 */
export function analysePausesFromLevels(samples, durationMs, opts = {}) {
  const { minGapMs = 250, minBlipMs = 120, minPauseMs = 400 } = opts;
  if (!samples || samples.length < 20) return null;

  const all = samples.map((s) => (Number.isFinite(s.db) ? s.db : -140)).sort((a, b) => a - b);
  // Near-digital silence (noise suppression, muted input) always counts as silence,
  // but it shouldn't drag the noise-floor estimate down to nothing.
  const live = all.filter((d) => d > -110);
  const basis = live.length >= all.length * 0.1 ? live : all;
  const floor = percentile(basis, 0.1);
  const peak = percentile(basis, 0.95);
  const range = peak - floor;
  if (range < 10) return null;
  // Speech sits within ~24 dB of its own peaks; room noise usually doesn't.
  let threshold = Math.max(floor + range * 0.3, peak - 24);
  threshold = Math.max(floor + 6, Math.min(threshold, peak - 10));

  const runs = [];
  for (let i = 0; i < samples.length; i++) {
    const db = Number.isFinite(samples[i].db) ? samples[i].db : -140;
    const speaking = db > threshold;
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
  return { source: 'audio', threshold, floor, peak, firstSpeech, lastSpeech, pauses, longest, runs: smooth };
}

/**
 * Last-resort pause estimate from recogniser result timing, used only when the
 * microphone levels are unusable. Chrome batches results, so this misses short
 * pauses and is labelled as an estimate in the UI.
 */
export function analysePausesFromEvents(events, durationMs, opts = {}) {
  const { minPauseMs = 1000 } = opts;
  const active = events.filter((e, i) => i === 0 || e.words !== events[i - 1].words);
  if (!active.length) return null;
  const pauses = [];
  for (let i = 1; i < active.length; i++) {
    const gap = active[i].t - active[i - 1].t;
    if (gap >= minPauseMs) pauses.push({ start: active[i - 1].t, end: active[i].t, duration: gap });
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

/** Recogniser events where the running word count grew: [{ t, n, index }]. */
function wordIncrements(events) {
  const out = [];
  let max = 0;
  for (const e of events) {
    if (e.words > max) { out.push({ t: e.t, n: e.words - max, index: max }); max = e.words; }
  }
  return out;
}

/**
 * Chrome reports words some time after they're spoken. Measure that delay at
 * clean speech onsets: after the lead-in silence (or any pause of 1 s+) the
 * first word to arrive belongs to the speech that just started.
 */
export function calibrateLatency(incs, runs) {
  const deltas = [];
  runs.forEach((r, i) => {
    const clean = !r.speaking && (i === 0 || r.end - r.start >= 1000);
    if (!clean || i === runs.length - 1) return;
    const e = incs.find((x) => x.t > r.end);
    if (e && e.t - r.end < 2500) deltas.push(e.t - r.end);
  });
  if (!deltas.length) return 600;
  deltas.sort((a, b) => a - b);
  return Math.min(1500, Math.max(150, deltas[Math.floor((deltas.length - 1) / 2)]));
}

/**
 * Attribute recognised words to the voiced stretch of audio they came from.
 * Returns { latency, runs: [{ start, end, silenceBefore, arrivals: [{t, n, index}] }] }.
 */
export function alignWordsToAudio(events, pauses) {
  if (pauses.source !== 'audio') return null;
  const incs = wordIncrements(events);
  const latency = calibrateLatency(incs, pauses.runs);
  const runs = [];
  let lastEnd = 0;
  for (const r of pauses.runs) {
    if (!r.speaking) continue;
    runs.push({ start: r.start, end: r.end, silenceBefore: r.start - lastEnd, arrivals: [] });
    lastEnd = r.end;
  }
  if (!runs.length) return null;
  for (const inc of incs) {
    const spoken = inc.t - latency;
    let idx = 0;
    for (let i = 0; i < runs.length && runs[i].start <= spoken + 250; i++) idx = i;
    runs[idx].arrivals.push(inc);
  }
  return { latency, runs };
}

/** Index of each word that follows a silence of at least `minGapMs`. */
export function wordsAfterPause(alignment, { minGapMs = 300 } = {}) {
  const out = new Set();
  if (!alignment) return out;
  for (const r of alignment.runs) {
    if (r.arrivals.length && r.silenceBefore >= minGapMs) out.add(r.arrivals[0].index);
  }
  return out;
}

/** Silent gaps of 0.4–2 s between the first and last word. */
export function findHesitations(pauses, { minMs = 400, maxMs = 2000 } = {}) {
  const gaps = pauses.pauses.filter((p) => p.duration >= minMs && p.duration <= maxMs);
  const avgMs = gaps.length ? gaps.reduce((s, g) => s + g.duration, 0) / gaps.length : 0;
  return { count: gaps.length, avgMs, gaps };
}

/**
 * Likely "um"/"uh": the mic heard voice, but the recogniser produced no words
 * for it. Chrome filters these sounds out of the transcript, so this is an
 * estimate, not a count. Three cases:
 *   • a voiced stretch between pauses with no words at all ("… [pause] ummm [pause] …")
 *   • voice at the start or end of a stretch that no word accounts for
 *   • a long gap between word arrivals while the audio stayed voiced
 */
export function estimateLikelyUms(levels, alignment, opts = {}) {
  const { minMs = 300, maxMs = 2500, edgeMs = 450, wordMs = 350 } = opts;
  if (!alignment) return null;
  const { latency, runs } = alignment;
  const totalWords = runs.reduce((a, r) => a + r.arrivals.reduce((b, x) => b + x.n, 0), 0);
  if (totalWords < 5) return null;

  // Typical spacing between word arrivals while talking.
  const gaps = [];
  for (const r of runs) for (let k = 1; k < r.arrivals.length; k++) gaps.push(r.arrivals[k].t - r.arrivals[k - 1].t);
  gaps.sort((a, b) => a - b);
  const baseline = gaps.length ? gaps[Math.floor(gaps.length * 0.75)] : 400;

  const spans = [];
  for (const r of runs) {
    const dur = r.end - r.start;
    if (!r.arrivals.length) {
      if (dur >= minMs && dur <= maxMs) spans.push({ start: r.start, end: r.end });
      continue;
    }
    const first = r.arrivals[0].t - latency;
    const last = r.arrivals[r.arrivals.length - 1].t - latency;
    if (first - r.start >= edgeMs) spans.push({ start: r.start, end: Math.min(r.end, first - 100) });
    if (r.end - (last + wordMs) >= edgeMs) spans.push({ start: last + wordMs, end: r.end });
    for (let k = 1; k < r.arrivals.length; k++) {
      const g = r.arrivals[k].t - r.arrivals[k - 1].t;
      if (g >= baseline + 600) {
        spans.push({ start: r.arrivals[k - 1].t - latency + wordMs, end: r.arrivals[k].t - latency - 100 });
      }
    }
  }

  // Hesitation sounds are low, voiced murmurs; breaths and clicks are hissy.
  const hasBalance = levels.some((s) => Number.isFinite(s.lh));
  const murmur = (sp) => {
    if (!hasBalance) return true;
    const inside = levels.filter((s) => s.t >= sp.start && s.t < sp.end && Number.isFinite(s.lh));
    if (!inside.length) return true;
    return inside.reduce((a, s) => a + s.lh, 0) / inside.length >= 0;
  };
  const found = spans
    .map((s) => ({ ...s, duration: s.end - s.start }))
    .filter((s) => s.duration >= minMs && s.duration <= maxMs && murmur(s))
    .sort((a, b) => a.start - b.start);
  return { count: found.length, spans: found };
}

/* ───────────── Pace ───────────── */

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

/* ───────────── Tip ───────────── */

const OPENER_WORDS = new Set(['so', 'well', 'okay', 'okay so', 'right', 'and yeah']);
const HEDGES = new Set(['basically', 'essentially', 'effectively', 'actually', 'literally', 'honestly', 'obviously', 'just', 'really', 'very']);

function adviceFor(phrase) {
  if (OPENER_WORDS.has(phrase)) return 'Try pausing silently instead, then open with the point itself.';
  if (HEDGES.has(phrase)) return 'Try cutting it; the sentence almost always works without it.';
  return 'Try pausing silently instead.';
}

/** One-line coaching tip based on the biggest crutch. */
export function crutchTip({ fillers, likelyUms, hesitations, openers }) {
  const top = fillers.counts[0];
  const ums = likelyUms ? likelyUms.count : 0;
  const opener = openers.flagged[0];
  const times = (n) => `${n} time${n === 1 ? '' : 's'}`;
  if (top && top.count >= 3 && top.count >= ums) {
    return `Your top crutch was “${top.phrase}” (${times(top.count)}). ${adviceFor(top.phrase)}`;
  }
  if (ums >= 3) {
    return `Around ${ums} likely “um”s were cut from your transcript. When you need a moment, close your mouth and pause silently.`;
  }
  if (opener) {
    return `${opener.count} sentences started with “${opener.word}”. Try opening each one with the point itself.`;
  }
  if (top && top.count >= 2) {
    return `Your top crutch was “${top.phrase}” (${times(top.count)}). ${adviceFor(top.phrase)}`;
  }
  if (hesitations && hesitations.count >= 6) {
    return `${hesitations.count} short hesitations. Sketch your two or three points before you start so the next idea is ready.`;
  }
  return 'No single crutch stood out. Keep doing what you’re doing.';
}

/* ───────────── Everything together ───────────── */

/**
 * input: { segments: [{text}], transcript?, durationMs, levels: [{t, db, lh}],
 *          events: [{t, words}], fillers }
 */
export function analyseSpeech({ segments, transcript, durationMs, levels = [], events = [], fillers }) {
  const joined = segments ? joinSegments(segments) : { text: transcript || '', offsets: [] };
  const text = joined.text;
  const tokens = tokenize(text);
  const wordCount = tokens.length;

  const pauses =
    analysePausesFromLevels(levels, durationMs) ||
    analysePausesFromEvents(events, durationMs) ||
    { source: 'none', firstSpeech: 0, lastSpeech: durationMs, pauses: [], longest: null, runs: null };

  // Line recogniser output up with the audio: which words follow a pause,
  // and which voiced sounds never became words.
  const alignment = alignWordsToAudio(events, pauses);
  const pauseBefore = wordsAfterPause(alignment);

  const fill = countFillers(text, fillers, { startOffsets: joined.offsets, pauseBefore });
  const openers = repeatedOpeners(text, joined.offsets);
  const hesitations = pauses.source === 'audio' ? findHesitations(pauses) : null;
  const likelyUms = estimateLikelyUms(levels, alignment);

  // Pace is measured over the time you were actually talking (first sound to last),
  // so a slow start or finishing a few seconds early doesn't skew it.
  let speakingMs = pauses.lastSpeech - pauses.firstSpeech;
  if (!(speakingMs > 3000) || speakingMs > durationMs) speakingMs = durationMs;
  const speakingMin = Math.max(speakingMs, 1000) / 60000;
  const wpm = wordCount ? Math.round(wordCount / speakingMin) : 0;
  const fillersPerMin = wordCount ? fill.total / speakingMin : 0;
  const longPauses = pauses.pauses.filter((p) => p.duration >= 2000).length;

  const stats = {
    transcript: text,
    segmentOffsets: joined.offsets,
    wordCount,
    durationMs,
    speakingMs,
    wpm,
    pace: paceBand(wpm),
    fillers: fill,
    fillersPerMin,
    fillerRating: fillerRating(fillersPerMin),
    likelyUms,
    hesitations,
    openers,
    latencyMs: alignment ? alignment.latency : null,
    pauses,
    longestPauseMs: pauses.longest ? pauses.longest.duration : null,
    longPauses,
    pauseRating: pauseRating(pauses.longest ? pauses.longest.duration : null),
    timeToFirstWordMs: pauses.source === 'none' ? null : pauses.firstSpeech,
    paceBuckets: paceBuckets(events, durationMs),
  };
  stats.tip = crutchTip(stats);
  return stats;
}
