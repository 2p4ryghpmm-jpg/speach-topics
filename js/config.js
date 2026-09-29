/*
 * ─────────────────────────────────────────────────────────────
 *  Extempore — user-editable settings
 *  Everything you're likely to want to tweak lives in this file.
 * ─────────────────────────────────────────────────────────────
 */

/*
 * Filler words & phrases counted in the speech analysis.
 *
 *  • A plain string counts every occurrence:            'basically'
 *  • Multi-word phrases work too:                       'you know'
 *  • Use an object with `ignoreAfter` to skip uses that are
 *    clearly not fillers, based on the word right before it:
 *        { phrase: 'like', ignoreAfter: ['looks', 'something'] }
 *    ("looks like a wave" is not a filler; "it's, like, a wave" is.)
 *
 * Note: Chrome's speech recogniser sometimes drops "um"/"uh" from the
 * transcript entirely, so treat those counts as a minimum.
 */
export const FILLER_WORDS = [
  'um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm',
  {
    phrase: 'like',
    ignoreAfter: [
      'looks', 'look', 'looked', 'looking', 'seems', 'seem', 'seemed',
      'sounds', 'sound', 'feel', 'feels', 'felt', 'something', 'things',
      'stuff', 'just', 'more', 'less', 'behaves', 'behave', 'behaving',
      'acts', 'act', 'would', 'i', 'we', 'they', "don't", "didn't",
      'exactly', 'much', 'very', 'not', 'nothing', 'anything', 'shaped',
    ],
  },
  {
    phrase: 'you know',
    ignoreAfter: ['do', 'did', "don't", "didn't", 'if', 'when', 'what', 'once', 'that', 'whether'],
  },
  {
    phrase: 'sort of',
    ignoreAfter: ['a', 'the', 'what', 'this', 'that', 'some', 'any', 'one', 'every', 'same', 'which', 'different', 'each'],
  },
  {
    phrase: 'kind of',
    ignoreAfter: ['a', 'the', 'what', 'this', 'that', 'some', 'any', 'one', 'every', 'same', 'which', 'different', 'each'],
  },
  'basically',
  'actually',
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
