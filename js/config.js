/*
 * ─────────────────────────────────────────────────────────────
 *  Extempore — user-editable settings
 *  Everything you're likely to want to tweak lives in this file.
 * ─────────────────────────────────────────────────────────────
 */

/*
 * Filler words & phrases counted from the transcript.
 * Matching is case-insensitive and whole-word; multi-word phrases are matched
 * first, so "okay so" never also counts as "so".
 *
 *  • A plain string is counted every time:              'basically'
 *  • Add `when` for words that are only fillers in some contexts:
 *      when: 'opener'  only at the start of a sentence, or right after a
 *                      pause of 0.3 s or more ("So, the key idea…")
 *      when: 'like'    only when "like" isn't introducing a noun phrase or used
 *                      as a verb ("behaves like a wave" and "I like it" don't count)
 *  • `possible: true` still counts, but is labelled "possible filler".
 *  • `ignoreAfter` skips uses that follow certain words ("what kind of").
 *
 * Chrome's recogniser deletes most "um"/"uh" sounds before we ever see them.
 * Those are estimated from the audio instead (see "Likely um/uh" in results).
 */
export const FILLER_WORDS = [
  // Hedges and intensifiers: counted every time.
  'basically', 'essentially', 'effectively', 'actually', 'literally',
  'honestly', 'obviously', 'really', 'very',

  // Phrases.
  'i mean', 'okay so', 'and yeah',
  { phrase: 'you know', ignoreAfter: ['do', 'did', "don't", "didn't", 'if', 'when', 'what', 'once', 'that', 'whether'] },
  { phrase: 'kind of', ignoreAfter: ['a', 'the', 'what', 'this', 'that', 'some', 'any', 'one', 'every', 'same', 'which', 'different', 'each'] },
  { phrase: 'sort of', ignoreAfter: ['a', 'the', 'what', 'this', 'that', 'some', 'any', 'one', 'every', 'same', 'which', 'different', 'each'] },

  // Only fillers at the start of a sentence or after a pause.
  { phrase: 'so', when: 'opener' },
  { phrase: 'well', when: 'opener' },
  { phrase: 'okay', when: 'opener' },
  { phrase: 'right', when: 'opener' },

  // "like" unless it introduces a noun phrase or is the verb.
  { phrase: 'like', when: 'like' },

  // Often legitimate ("just enough energy"), so flagged as possible.
  { phrase: 'just', possible: true },

  // Rarely survive Chrome's transcription, but counted if they do.
  'um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm',
];

/* Topic categories and their draw weights (must add up to 100). */
export const CATEGORIES = {
  physics: { label: 'Physics',           weight: 35, color: '#8f8cff' },
  cs:      { label: 'Computer Science',  weight: 30, color: '#3fe0b5' },
  general: { label: 'General Knowledge', weight: 35, color: '#ffb45e' },
};

/* Prep modes. `prepSeconds` is the countdown before the speech. */
export const MODES = {
  cuff: { label: 'Off the Cuff',  prepSeconds: 5 * 60 },
  deep: { label: 'Deep Research', prepSeconds: 20 * 60 },
};

/* Length of the speech itself, in seconds. */
export const SPEECH_SECONDS = 60;

/* Accents offered in Settings for Chrome's speech recogniser. */
export const SPEECH_LANGS = [
  ['en-GB', 'English (UK)'],
  ['en-US', 'English (US)'],
  ['en-AU', 'English (Australia)'],
  ['en-CA', 'English (Canada)'],
  ['en-IN', 'English (India)'],
  ['en-IE', 'English (Ireland)'],
  ['en-NZ', 'English (New Zealand)'],
  ['en-ZA', 'English (South Africa)'],
];
export const DEFAULT_SPEECH_LANG = 'en-GB';

/* Pace bands in words per minute, used for the readout labels. */
export const PACE_BANDS = [
  { max: 100,      label: 'Very slow',      tone: 'warn' },
  { max: 120,      label: 'Measured',       tone: 'ok' },
  { max: 160,      label: 'Conversational', tone: 'good' },
  { max: 180,      label: 'Brisk',          tone: 'ok' },
  { max: Infinity, label: 'Rushed',         tone: 'warn' },
];
export const IDEAL_WPM = [120, 160];

/*
 * Dev helper: append ?prep=10&speech=15 to the URL to shorten the
 * timers (in seconds) while testing. Ignored when absent.
 */
const params = new URLSearchParams(location.search);
export const DEV_PREP_SECONDS = Number(params.get('prep')) || null;
export const DEV_SPEECH_SECONDS = Number(params.get('speech')) || null;
