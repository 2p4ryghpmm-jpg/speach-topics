/*
 * Extempore: app controller.
 * Screens: draw → prep → speak → results.
 */
import {
  CATEGORIES, MODES, SPEECH_SECONDS, FILLER_WORDS, SPEECH_LANGS, DEFAULT_SPEECH_LANG,
  DEV_PREP_SECONDS, DEV_SPEECH_SECONDS,
} from './config.js';
import { TOPICS } from './topics.js';
import { Countdown, fmtClock, every } from './timer.js';
import { SpeechSession, speechSupported } from './speech.js';
import { MicMonitor, ensureAudio, chimes, setMuted } from './audio.js';
import { analyseSpeech, countFillers, tokenize } from './analysis.js';
import { buildTranscript, transcriptFilename, downloadText } from './export.js';
import {
  startStarfield, Wheel, Dial, RadialViz, revealWords, fadeOutText, reel, countUp,
  setFaviconProgress, resetFavicon, notificationIcon, esc, wait, reducedMotion,
} from './visuals.js';
import {
  renderGauge, renderTimeline, renderFillerBars, transcriptHTML,
  renderWordSpark, renderFillerDots, renderPauseStrip,
} from './charts.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const BASE_TITLE = document.title;

/* ───────────── Persistence ───────────── */

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`extempore.${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`extempore.${key}`, JSON.stringify(value)); } catch { /* private mode */ }
  },
};

const settings = { mode: 'cuff', lang: DEFAULT_SPEECH_LANG, muted: false, ...store.get('settings', {}) };
if (!MODES[settings.mode]) settings.mode = 'cuff';
const saveSettings = () => store.set('settings', settings);
setMuted(settings.muted);

const seen = store.get('seen', {});

/* ───────────── State ───────────── */

const state = {
  screen: 'draw',
  topic: null,
  spinning: false,
  prep: null, // { mode, totalMs, usedMs, outcome: 'running' | 'full' | 'early' | 'skipped' }
  notes: '',
  result: null,
};

const prepMs = () => (DEV_PREP_SECONDS ?? MODES[settings.mode].prepSeconds) * 1000;
const speechMs = () => (DEV_SPEECH_SECONDS ?? SPEECH_SECONDS) * 1000;
const accent = () => (state.topic ? CATEGORIES[state.topic.category].color : '#c9cbff');

/* ───────────── Elements & components ───────────── */

const els = {
  topicText: $('#topic-text'),
  topicCat: $('#topic-cat'),
  topicArea: $('#topic-area'),
  topicSep: $('#topic-meta .sep'),
  topicHint: $('#topic-hint'),
  spinBtn: $('#spin-btn'),
  spinLabel: $('#spin-label'),
  prepBtn: $('#prep-btn'),
  prepLen: $('#prep-len'),
  skipBtn: $('#skip-btn'),
  pauseBtn: $('#pause-btn'),
  notes: $('#notes'),
  speakStatus: $('#speak-status'),
  startSpeechBtn: $('#start-speech-btn'),
  finishBtn: $('#finish-btn'),
  liveTranscript: $('#live-transcript'),
  liveWords: $('#live-words'),
  liveWpm: $('#live-wpm'),
  liveFillers: $('#live-fillers'),
  settings: $('#settings'),
  settingsBtn: $('#settings-btn'),
  toast: $('#toast'),
};

const starfield = startStarfield($('#stars'));
const wheel = new Wheel($('#wheel'));
const prepDial = new Dial($('#prep-dial'));
const speakDial = new Dial($('#speak-dial'), { viz: true });
const viz = new RadialViz($('#speak-dial .dial-viz'));

/* ───────────── Helpers ───────────── */

let toastTimer = null;
function toast(message, kind = 'info', ms = 4200) {
  els.toast.textContent = message;
  els.toast.dataset.kind = kind;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function setCategory(key) {
  document.body.dataset.cat = key || '';
  const color = key ? CATEGORIES[key].color : '#c9cbff';
  document.documentElement.style.setProperty('--accent', color);
  starfield.setTint(color);
  viz.color = color;
}

function fillStage() {
  const t = state.topic;
  if (!t) return;
  $$('.js-topic').forEach((el) => { el.textContent = t.text; });
  $$('.js-cat').forEach((el) => { el.textContent = CATEGORIES[t.category].label; });
  $$('.js-area').forEach((el) => { el.textContent = t.area; });
}

let screenQueue = Promise.resolve();
function showScreen(name) {
  screenQueue = screenQueue.then(async () => {
    if (state.screen === name) return;
    const from = $(`#screen-${state.screen}`);
    const to = $(`#screen-${name}`);
    state.screen = name;
    document.body.dataset.screen = name;
    if (!reducedMotion()) {
      await from.animate(
        [
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
          { opacity: 0, transform: 'translateY(-12px) scale(0.985)', filter: 'blur(6px)' },
        ],
        { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }
      ).finished;
    }
    from.hidden = true;
    from.getAnimations().forEach((a) => a.cancel());
    to.hidden = false;
    window.scrollTo({ top: 0 });
    if (!reducedMotion()) {
      to.animate(
        [
          { opacity: 0, transform: 'translateY(16px)', filter: 'blur(8px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        ],
        { duration: 560, easing: 'cubic-bezier(.2,.75,.2,1)' }
      );
    }
    if (name === 'results') renderTimelineNow();
  });
  return screenQueue;
}

/* ───────────── Topic drawing ───────────── */

function pickCategory() {
  const entries = Object.entries(CATEGORIES);
  const total = entries.reduce((s, [, c]) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const [key, c] of entries) {
    r -= c.weight;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Random topic from the category, avoiding ones you've already drawn until the pool runs out. */
function drawTopic(category) {
  const pool = TOPICS[category];
  const already = new Set(seen[category] || []);
  let fresh = pool.filter((t) => !already.has(t.id) && t.id !== state.topic?.id);
  if (!fresh.length) {
    seen[category] = [];
    fresh = pool.filter((t) => t.id !== state.topic?.id);
  }
  const topic = fresh[Math.floor(Math.random() * fresh.length)];
  (seen[category] ||= []).push(topic.id);
  store.set('seen', seen);
  updateSeenCount();
  return topic;
}

const ALL_AREAS = [...new Set(Object.values(TOPICS).flat().map((t) => t.area))];

async function spin() {
  if (state.spinning || state.screen !== 'draw') return;
  ensureAudio();
  state.spinning = true;
  document.body.classList.add('is-spinning');
  els.spinBtn.disabled = true;
  els.prepBtn.disabled = true;
  els.skipBtn.disabled = true;

  const category = pickCategory();
  const topic = drawTopic(category);

  // Hold the topic's height while it's empty so the page doesn't jump mid-spin.
  const block = els.topicText;
  block.style.minHeight = `${block.offsetHeight}px`;
  await fadeOutText(els.topicText);
  els.topicHint.classList.add('gone');
  els.topicText.innerHTML = '';
  els.topicCat.textContent = 'Drawing';
  els.topicSep.hidden = false;
  document.body.dataset.cat = '';

  const areas = [...ALL_AREAS].sort(() => Math.random() - 0.5);
  await Promise.all([wheel.spin(category), reel(els.topicArea, areas, reducedMotion() ? 0 : 2500)]);

  chimes.land(category === 'physics' ? 740 : category === 'cs' ? 830 : 660);
  state.topic = topic;
  state.notes = '';
  els.notes.value = '';
  setCategory(category);

  els.topicCat.textContent = CATEGORIES[category].label;
  els.topicArea.textContent = topic.area;
  els.topicArea.classList.remove('flick');
  $('#topic-meta').classList.remove('landed');
  void $('#topic-meta').offsetWidth;
  $('#topic-meta').classList.add('landed');
  block.style.minHeight = '';
  revealWords(els.topicText, topic.text);

  els.spinLabel.textContent = 'Spin again';
  els.prepBtn.hidden = false;
  els.skipBtn.hidden = false;
  $('#draw-actions').classList.add('revealed');
  els.spinBtn.disabled = false;
  els.prepBtn.disabled = false;
  els.skipBtn.disabled = false;
  state.spinning = false;
  document.body.classList.remove('is-spinning');
}

/* ───────────── Prep ───────────── */

let prepTimer = null;

function startPrep() {
  if (!state.topic || state.spinning) return;
  ensureAudio();
  askNotificationPermission();
  const total = prepMs();
  state.prep = { mode: settings.mode, totalMs: total, usedMs: 0, outcome: 'running' };
  prepTimer?.stop();
  prepTimer = new Countdown(total, { tickMs: 250, onTick: onPrepTick, onDone: onPrepDone });
  prepDial.setPhase('normal');
  prepDial.setSub(`${MODES[settings.mode].label.toLowerCase()} prep`);
  prepDial.setProgress(0);
  setPaused(false);
  fillStage();
  showScreen('prep');
  prepTimer.start();
}

function onPrepTick(t) {
  const rem = t.remaining;
  prepDial.setTime(fmtClock(rem));
  const warnAt = Math.min(60000, t.duration * 0.2);
  prepDial.setPhase(rem <= 10000 ? 'critical' : rem <= warnAt ? 'warn' : 'normal');
  const title = `${t.running ? '' : '❚❚ '}${fmtClock(rem)} · prep · Extempore`;
  if (document.title !== title) {
    document.title = title;
    setFaviconProgress(rem / t.duration, accent());
  }
}

async function onPrepDone() {
  state.prep.usedMs = state.prep.totalMs;
  state.prep.outcome = 'full';
  chimes.prepDone();
  sendPrepNotification();
  prepDial.setProgress(1);
  prepDial.setTime('0:00');
  prepDial.setSub('time’s up');
  prepDial.burst();
  resetFavicon();
  document.title = `⏰ Prep’s up! · Extempore`;
  startTitleBlink('⏰ Prep’s up!');
  await wait(1100);
  if (state.screen === 'prep') enterSpeak({ auto: false, afterPrep: true });
}

function setPaused(paused) {
  els.pauseBtn.classList.toggle('is-paused', paused);
  els.pauseBtn.querySelector('span').textContent = paused ? 'Resume' : 'Pause';
  $('#prep-dial').classList.toggle('paused', paused);
}

function togglePause() {
  if (!prepTimer || prepTimer.done) return;
  if (prepTimer.running) { prepTimer.pause(); setPaused(true); }
  else { prepTimer.resume(); setPaused(false); }
}

function readyNow() {
  if (!prepTimer || prepTimer.done) return;
  prepTimer.stop();
  state.prep.usedMs = prepTimer.elapsed;
  state.prep.outcome = 'early';
  resetFavicon();
  enterSpeak({ auto: true });
}

function skipPrep() {
  if (!state.topic || state.spinning) return;
  ensureAudio();
  state.prep = { mode: settings.mode, totalMs: prepMs(), usedMs: 0, outcome: 'skipped' };
  enterSpeak({ auto: true });
}

function leavePrep() {
  prepTimer?.stop();
  prepTimer = null;
  resetFavicon();
  document.title = BASE_TITLE;
  showScreen('draw');
}

/* ───────────── Notifications ───────────── */

let activeNotification = null;
let blinkTimer = null;

function askNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  Notification.requestPermission().then(updateNotifButton).catch(() => {});
}

function sendPrepNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    activeNotification?.close();
    const n = new Notification('Prep time’s up', {
      body: `${state.topic.text}\nHead back and deliver your one-minute speech.`,
      icon: notificationIcon(accent()),
      tag: 'extempore-prep',
      requireInteraction: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
    activeNotification = n;
  } catch { /* some platforms only allow notifications from a service worker */ }
}

function startTitleBlink(message) {
  stopTitleBlink();
  if (!document.hidden) return;
  let on = true;
  blinkTimer = setInterval(() => {
    on = !on;
    document.title = on ? message : `${fmtClock(0)} · Extempore`;
  }, 1000);
}

function stopTitleBlink() {
  clearInterval(blinkTimer);
  blinkTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (blinkTimer) {
    stopTitleBlink();
    document.title = BASE_TITLE;
  }
  activeNotification?.close();
  activeNotification = null;
});

/* ───────────── Speech ───────────── */

let speakPhase = 'armed'; // armed | starting | countdown | recording | processing
let mic = null;
let session = null;
let speechTimer = null;
let stopSampler = null;
let runId = 0;

const STATUS = {
  armed: 'One minute on the clock, after a three-second countdown.',
  armedAfterPrep: 'Prep time’s up. Start when you’re ready.',
  starting: 'Waiting for the microphone…',
  countdown: 'Deep breath…',
  recording: 'Listening',
  processing: 'Analysing your speech…',
};

function setSpeakPhase(phase, { afterPrep = false } = {}) {
  speakPhase = phase;
  $('#screen-speak').dataset.phase = phase;
  const supported = speechSupported();
  els.startSpeechBtn.hidden = !(phase === 'armed' || phase === 'starting');
  els.startSpeechBtn.disabled = phase !== 'armed' || !supported;
  els.finishBtn.hidden = phase !== 'recording';
  let status = afterPrep && phase === 'armed' ? STATUS.armedAfterPrep : STATUS[phase];
  if (!supported && phase === 'armed') status = 'Speech recognition needs Google Chrome on desktop.';
  els.speakStatus.innerHTML = phase === 'recording'
    ? `<span class="rec-dot"></span>${esc(status)}`
    : esc(status);
  els.speakStatus.classList.toggle('alert', afterPrep && phase === 'armed');
  const sub = { armed: 'one minute', starting: 'mic check', countdown: 'get ready', recording: 'remaining', processing: 'analysing' }[phase];
  speakDial.setSub(sub);
  if (phase === 'armed') {
    speakDial.setPhase('normal');
    speakDial.setProgress(0);
    speakDial.setTime(fmtClock(speechMs()));
  }
  if (phase === 'processing') speakDial.setPhase('done');
}

function resetLive() {
  els.liveTranscript.innerHTML = '<p class="placeholder">Your words will appear here as you speak.</p>';
  els.liveWords.textContent = '0';
  els.liveWpm.textContent = '–';
  els.liveFillers.textContent = '0';
}

function enterSpeak({ auto = false, afterPrep = false } = {}) {
  fillStage();
  resetLive();
  const cue = $('#cue-card');
  const notes = state.notes.trim();
  cue.hidden = !notes;
  $('#cue-notes').textContent = notes;
  cue.open = Boolean(notes);
  setSpeakPhase('armed', { afterPrep });
  if (!blinkTimer) document.title = BASE_TITLE;
  showScreen('speak');
  if (auto && speechSupported()) beginSpeech();
}

function micErrorMessage(err) {
  if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
    return 'Microphone access was blocked. Click the icon in the address bar to allow it, then try again.';
  }
  if (err && err.name === 'NotFoundError') return 'No microphone found. Plug one in and try again.';
  return 'Couldn’t start the microphone.';
}

async function beginSpeech() {
  if (speakPhase !== 'armed' || !speechSupported()) return;
  const id = ++runId;
  ensureAudio();
  setSpeakPhase('starting');

  const m = new MicMonitor();
  try {
    await m.open();
  } catch (err) {
    if (id === runId) {
      toast(micErrorMessage(err), 'error', 6000);
      setSpeakPhase('armed');
    }
    return;
  }
  if (id !== runId) { m.close(); return; }
  mic = m;

  // Start the recogniser during the countdown so it's warmed up by "go".
  session = new SpeechSession({ lang: settings.lang, onUpdate: renderLive, onError: onSpeechError });
  try {
    session.start();
  } catch {
    toast('Couldn’t start speech recognition.', 'error');
    abortSpeech();
    return;
  }

  setSpeakPhase('countdown');
  for (const n of [3, 2, 1]) {
    speakDial.pop(String(n));
    chimes.tick();
    await wait(reducedMotion() ? 700 : 1000);
    if (id !== runId) return;
  }
  chimes.tick(true);

  const t0 = performance.now();
  session.reset(t0);
  mic.startRecording(t0);
  stopSampler = every(50, () => mic?.sample(performance.now()));
  speechTimer = new Countdown(speechMs(), { tickMs: 100, onTick: onSpeechTick, onDone: finishSpeech });
  setSpeakPhase('recording');
  speakDial.setTime(fmtClock(speechMs()));
  speechTimer.start();
}

function onSpeechTick(t) {
  const rem = t.remaining;
  speakDial.setTime(fmtClock(rem));
  speakDial.setPhase(rem <= 10000 ? 'critical' : rem <= 20000 ? 'warn' : 'normal');
  const title = `● ${fmtClock(rem)} · speaking · Extempore`;
  if (document.title !== title) {
    document.title = title;
    setFaviconProgress(rem / t.duration, '#ff5d6c');
  }
  updateLiveWpm();
}

function renderLive({ final, interim }) {
  if (speakPhase !== 'recording' || !session) return;
  const text = `${final} ${interim}`.trim();
  if (!text) return;
  // Each recognition segment starts after a pause, which the context rules
  // ("so" as an opener, etc.) need to know about.
  const offsets = session.segmentOffsets;
  const finalHtml = final
    ? transcriptHTML(final, countFillers(final, FILLER_WORDS, { startOffsets: offsets }).hits).slice(3, -4)
    : '';
  els.liveTranscript.innerHTML =
    `<p>${finalHtml}${interim ? ` <span class="interim">${esc(interim)}</span>` : ''}</p>`;
  els.liveWords.textContent = String(tokenize(text).length);
  const liveOffsets = final && interim ? [...offsets, final.length + 1] : offsets;
  els.liveFillers.textContent = String(countFillers(text, FILLER_WORDS, { startOffsets: liveOffsets }).total);
  els.liveTranscript.scrollTop = els.liveTranscript.scrollHeight;
  updateLiveWpm();
}

function updateLiveWpm() {
  if (!speechTimer || !session) return;
  const elapsed = speechTimer.elapsed;
  if (elapsed < 5000) return;
  const words = tokenize(session.text).length;
  els.liveWpm.textContent = String(Math.round(words / (elapsed / 60000)));
}

function onSpeechError(message) {
  toast(message, 'error', 7000);
  if (speakPhase === 'recording' && session && tokenize(session.text).length > 3) {
    finishSpeech();
  } else {
    abortSpeech();
  }
}

async function finishSpeech() {
  if (speakPhase !== 'recording') return;
  const id = runId;
  const durationMs = Math.min(speechMs(), Math.max(1000, speechTimer.elapsed));
  speechTimer.stop();
  stopSampler?.();
  stopSampler = null;
  const levels = mic ? mic.stopRecording() : [];
  setSpeakPhase('processing');
  speakDial.setProgress(1);
  speakDial.setTime('0:00');
  speakDial.burst();
  chimes.speechDone();

  await session.stop();
  if (id !== runId) return;
  const { events, segments } = session;
  session = null;
  mic?.close();
  mic = null;
  resetFavicon();
  document.title = BASE_TITLE;

  const stats = analyseSpeech({ segments, durationMs, levels, events, fillers: FILLER_WORDS });
  state.result = { stats, levels, events, date: new Date() };
  if (DEV_PREP_SECONDS || DEV_SPEECH_SECONDS) window.__extemporeResult = state.result; // for testing
  renderResults();
  await wait(reducedMotion() ? 0 : 450);
  showScreen('results');
}

function abortSpeech() {
  runId++;
  session?.abort();
  session = null;
  speechTimer?.stop();
  speechTimer = null;
  stopSampler?.();
  stopSampler = null;
  mic?.close();
  mic = null;
  viz.clear();
  resetFavicon();
  document.title = BASE_TITLE;
  setSpeakPhase('armed');
}

/* ───────────── Results ───────────── */

function toneClass(tone) { return `tone-${tone}`; }

function setPill(el, { label, tone }) {
  el.textContent = label;
  el.className = `stat-pill ${toneClass(tone)}`;
}

function verdict(stats) {
  if (!stats.wordCount) return 'No speech was picked up. Check your microphone and give it another go.';
  const pace = {
    'Very slow': 'A very slow pace',
    Measured: 'A measured pace',
    Conversational: 'A natural, conversational pace',
    Brisk: 'A brisk pace',
    Rushed: 'A rushed pace',
  }[stats.pace.label] || 'Your pace';
  const fill = stats.fillerRating.tone === 'good' ? 'clean delivery'
    : stats.fillerRating.tone === 'ok' ? 'a few filler words'
    : 'quite a few filler words';
  const pause = stats.longestPauseMs == null || stats.longestPauseMs < 3000
    ? 'no awkward silences'
    : `one ${(stats.longestPauseMs / 1000).toFixed(1)}-second gap to work on`;
  return `${pace}, ${fill}, and ${pause}.`;
}

function renderResults() {
  const { stats } = state.result;
  fillStage();
  $('#verdict').textContent = verdict(stats);

  renderWordSpark($('#r-words-spark'), state.result.events, stats.durationMs);
  renderFillerDots($('#r-filler-dots'), stats.fillers.total);
  renderPauseStrip($('#r-pause-strip'), stats);

  countUp($('#r-words'), stats.wordCount);
  $('#r-words-note').textContent = `over ${fmtClock(stats.speakingMs, { ceil: false })} of speaking`;

  renderGauge($('#r-gauge'), stats.wpm);
  countUp($('#r-wpm'), stats.wpm, { delay: 90 });
  setPill($('#r-pace-pill'), stats.pace);

  countUp($('#r-fillers'), stats.fillers.total, { delay: 180 });
  const possible = stats.fillers.possibleTotal;
  $('#r-fillers-note').textContent = stats.wordCount
    ? `${stats.fillersPerMin.toFixed(1)} per minute · from the transcript${possible ? ` · ${possible} possible` : ''}`
    : '–';
  setPill($('#r-filler-pill'), stats.fillerRating);

  renderCrutches(stats);

  const lp = stats.pauses.longest;
  countUp($('#r-pause'), lp ? lp.duration / 1000 : 0, { decimals: 1, delay: 270 });
  $('#r-pause-note').textContent = lp
    ? `at ${fmtClock(Math.round(lp.start / 1000) * 1000)} · ${stats.longPauses} pause${stats.longPauses === 1 ? '' : 's'} over 2 s`
    : 'no pauses over 0.4 s';
  setPill($('#r-pause-pill'), stats.pauseRating);

  const src = stats.pauses.source;
  const first = stats.timeToFirstWordMs != null ? ` First word after ${(stats.timeToFirstWordMs / 1000).toFixed(1)} s.` : '';
  $('#r-timeline-note').textContent =
    (src === 'audio' ? 'Pauses detected from your microphone’s volume levels.'
      : src === 'recognition' ? 'Pauses estimated from recognition timing (mic levels were too flat to read reliably).'
      : 'Not enough audio to detect pauses.') + first;

  renderFillerBars($('#r-filler-bars'), stats.fillers);
  $('#r-filler-line').innerHTML = stats.fillers.counts
    .map((c) => `<span class="${c.possible ? 'possible' : ''}">${esc(c.phrase)} <b>×${c.count}</b>${c.possible ? ' <em>possible</em>' : ''}</span>`)
    .join('');
  $('#r-transcript').innerHTML = transcriptHTML(stats.transcript, stats.fillers.hits);
  $('#r-transcript-meta').textContent = `${stats.wordCount} words · fillers highlighted`;

  // Replay the entrance animations.
  $$('#screen-results .stat-card, #screen-results .panel, #screen-results .tip').forEach((el) => {
    el.classList.remove('in');
    void el.offsetWidth;
    el.classList.add('in');
  });
  if (state.screen === 'results') renderTimelineNow();
}

const secs1 = (ms) => `${(ms / 1000).toFixed(1)} s`;

/** The "estimated from audio" panel and the one-line tip. */
function renderCrutches(stats) {
  const ums = stats.likelyUms;
  countUp($('#r-ums'), ums ? ums.count : 0, { delay: 320 });
  $('#r-ums').parentElement.classList.toggle('na', !ums);
  $('#r-ums-note').textContent = !ums
    ? 'Needs clear microphone audio to estimate'
    : ums.count
      ? `${secs1(ums.spans.reduce((a, s) => a + s.duration, 0))} of voice with no words recognised`
      : 'Every voiced sound turned into words';

  const hes = stats.hesitations;
  countUp($('#r-hes'), hes ? hes.count : 0, { delay: 380 });
  $('#r-hes').parentElement.classList.toggle('na', !hes);
  $('#r-hes-avg').textContent = hes && hes.count ? `avg ${secs1(hes.avgMs)}` : '';
  $('#r-hes-note').textContent = !hes
    ? 'Needs clear microphone audio to measure'
    : 'Silent gaps of 0.4–2 s between words';

  const op = stats.openers;
  const top = op.flagged[0];
  $('#r-openers').innerHTML = top
    ? op.flagged.slice(0, 2).map((f) => `<span>“${esc(f.word)}”</span> <small>×${f.count}</small>`).join('<i>·</i>')
    : '<span class="ok">None</span>';
  $('#r-openers').classList.toggle('flag', Boolean(top));
  $('#r-openers-note').textContent = top
    ? `${top.count} of your ${op.sentences} sentences start with “${top.word}”`
    : `No word starts 3+ of your ${op.sentences} sentences`;

  $('#r-tip-text').textContent = stats.tip;
}

function renderTimelineNow(animate = true) {
  if (!state.result) return;
  const { stats, levels, events } = state.result;
  renderTimeline($('#r-timeline'), stats, levels, events, { animate });
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.screen === 'results') renderTimelineNow(false); }, 150);
});

function modeLine(prep) {
  const m = MODES[prep.mode];
  const total = fmtClock(prep.totalMs);
  if (prep.outcome === 'skipped') return `${m.label} (${total} prep), prep skipped`;
  if (prep.outcome === 'early') return `${m.label}, prepared for ${fmtClock(prep.usedMs, { ceil: false })} of ${total}`;
  return `${m.label}, full ${total} prep`;
}

function transcriptText() {
  const { stats, date } = state.result;
  return buildTranscript({
    topic: state.topic,
    categoryLabel: CATEGORIES[state.topic.category].label,
    modeLine: modeLine(state.prep),
    date,
    notes: state.notes,
    stats,
  });
}

function download() {
  if (!state.result) return;
  downloadText(transcriptFilename(state.topic, state.result.date), transcriptText());
  toast('Transcript downloaded. Paste it into Claude for content feedback.');
}

async function copyTranscript() {
  if (!state.result) return;
  try {
    await navigator.clipboard.writeText(transcriptText());
    toast('Copied to clipboard.');
  } catch {
    toast('Couldn’t access the clipboard. Use Download instead.', 'error');
  }
}

async function sameTopicAgain() {
  await showScreen('draw');
}

async function newTopic() {
  await showScreen('draw');
  spin();
}

/* ───────────── Settings & chrome ───────────── */

function updateModeUI() {
  const sw = $('.mode-switch');
  sw.dataset.active = settings.mode;
  $$('.mode-switch button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === settings.mode)));
  els.prepLen.textContent = fmtClock(prepMs());
}

function updateSoundUI() {
  const btn = $('#sound-btn');
  btn.classList.toggle('muted', settings.muted);
  btn.setAttribute('aria-label', settings.muted ? 'Unmute sounds' : 'Mute sounds');
  btn.title = settings.muted ? 'Sounds off' : 'Sounds on';
}

function updateNotifButton() {
  const btn = $('#notif-btn');
  if (!('Notification' in window)) {
    btn.textContent = 'Unavailable'; btn.disabled = true; return;
  }
  const p = Notification.permission;
  btn.textContent = p === 'granted' ? 'Enabled ✓' : p === 'denied' ? 'Blocked' : 'Enable';
  btn.disabled = p !== 'default';
  btn.title = p === 'denied' ? 'Allow notifications for this site from the address bar' : '';
}

function updateSeenCount() {
  const total = Object.values(TOPICS).reduce((s, l) => s + l.length, 0);
  const n = Object.values(seen).reduce((s, l) => s + l.length, 0);
  const el = $('#seen-count');
  if (el) el.textContent = `${n} / ${total}`;
}

function openSettings(open) {
  // Don't leave focus stranded inside a hidden popover, or shortcuts stop working.
  if (!open && els.settings.contains(document.activeElement)) document.activeElement.blur();
  els.settings.hidden = !open;
  els.settingsBtn.setAttribute('aria-expanded', String(open));
}

function initChrome() {
  updateModeUI();
  updateSoundUI();
  updateNotifButton();
  updateSeenCount();

  const langSel = $('#lang-select');
  langSel.innerHTML = SPEECH_LANGS.map(([code, label]) => `<option value="${code}">${esc(label)}</option>`).join('');
  langSel.value = settings.lang;
  langSel.addEventListener('change', () => { settings.lang = langSel.value; saveSettings(); });

  $$('.mode-switch button').forEach((b) => b.addEventListener('click', () => {
    if (state.screen !== 'draw') return;
    settings.mode = b.dataset.mode;
    saveSettings();
    updateModeUI();
  }));

  $('#sound-btn').addEventListener('click', () => {
    settings.muted = !settings.muted;
    setMuted(settings.muted);
    saveSettings();
    updateSoundUI();
    if (!settings.muted) { ensureAudio(); chimes.land(880); }
  });

  els.settingsBtn.addEventListener('click', () => openSettings(els.settings.hidden));
  document.addEventListener('click', (e) => {
    if (!els.settings.hidden && !e.target.closest('#settings, #settings-btn')) openSettings(false);
  });
  $('#notif-btn').addEventListener('click', () => {
    if ('Notification' in window) Notification.requestPermission().then(updateNotifButton);
  });
  $('#reset-seen').addEventListener('click', () => {
    for (const k of Object.keys(seen)) delete seen[k];
    store.set('seen', seen);
    updateSeenCount();
    toast('Topic history cleared. Every topic is back in the draw.');
  });

  if (!speechSupported()) $('#unsupported').hidden = false;
}

/* ───────────── Wiring ───────────── */

els.spinBtn.addEventListener('click', spin);
els.prepBtn.addEventListener('click', startPrep);
els.skipBtn.addEventListener('click', skipPrep);
els.pauseBtn.addEventListener('click', togglePause);
$('#ready-btn').addEventListener('click', readyNow);
$('#prep-back').addEventListener('click', leavePrep);
els.notes.addEventListener('input', () => { state.notes = els.notes.value; });
els.startSpeechBtn.addEventListener('click', beginSpeech);
els.finishBtn.addEventListener('click', finishSpeech);
$('#speak-back').addEventListener('click', () => { abortSpeech(); showScreen('draw'); });
$('#download-btn').addEventListener('click', download);
$('#copy-btn').addEventListener('click', copyTranscript);
$('#retry-btn').addEventListener('click', sameTopicAgain);
$('#new-btn').addEventListener('click', newTopic);

// Mouse clicks shouldn't leave focus on a button, or Space/Enter would re-trigger it
// instead of the global shortcuts.
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && e.detail > 0) b.blur();
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.key === 'Escape' && !els.settings.hidden) { openSettings(false); return; }
  const t = e.target;
  if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) {
    if (e.key === 'Escape') t.blur();
    return;
  }
  // Let focused buttons handle their own Enter/Space.
  if (t.closest && t.closest('button, a, summary') && (e.key === 'Enter' || e.key === ' ')) return;
  const key = e.key.toLowerCase();

  switch (state.screen) {
    case 'draw':
      if (e.code === 'Space') { e.preventDefault(); spin(); }
      else if (key === 'enter' && state.topic) { e.preventDefault(); startPrep(); }
      else if (key === 's' && state.topic) skipPrep();
      break;
    case 'prep':
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      else if (key === 'enter') { e.preventDefault(); readyNow(); }
      break;
    case 'speak':
      if (key === 'enter' && speakPhase === 'armed') { e.preventDefault(); beginSpeech(); }
      break;
    case 'results':
      if (key === 'd') download();
      else if (key === 'n') newTopic();
      break;
  }
});

window.addEventListener('beforeunload', (e) => {
  if (state.screen === 'prep' || (state.screen === 'speak' && speakPhase !== 'armed')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ───────────── Render loop ───────────── */

function frame(now) {
  if (state.screen === 'prep' && prepTimer && !prepTimer.done) {
    prepDial.setProgress(prepTimer.progress);
  } else if (state.screen === 'speak') {
    if (speechTimer && speakPhase === 'recording') speakDial.setProgress(speechTimer.progress);
    viz.draw(mic ? mic.frequencies() : null, now, Boolean(mic));
  }
  requestAnimationFrame(frame);
}

initChrome();
setCategory(null);
revealWords(els.topicText, els.topicText.textContent.trim(), { stagger: 60 });
requestAnimationFrame(frame);
