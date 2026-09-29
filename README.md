# extempore

An impromptu-speaking practice site in the spirit of [unprompted.cool](https://unprompted.cool).
Spin for a topic, prepare against a countdown, then deliver a one-minute speech. It's transcribed
live and analysed in your browser.

- **Topics:** Physics (35%), Computer Science (30%) and General Knowledge (35%). Physics draws on
  Cambridge 9702 AS areas, CS on 9618 AS, and General Knowledge covers paradoxes, theorems and
  thought experiments. All topics are written as prompts worth a researched minute. Topics you've
  already drawn aren't repeated until you've seen the whole category.
- **Modes:** *Off the Cuff* (5 min prep) or *Deep Research* (20 min prep), plus *Skip prep* to go
  straight to the speech.
- **Prep timer:** a large animated dial, a live countdown in the tab title and favicon, a scratchpad
  for notes, and a browser notification plus chime when time's up. It stays accurate in a background
  tab because it ticks from a Web Worker, which Chrome doesn't throttle.
- **Speech:** a one-minute timer with a live voice visualiser. The transcript appears as you talk,
  with filler words highlighted as they happen.
- **Analysis (local, no API):**
  - word count and words per minute;
  - context-aware filler words, with a breakdown;
  - *estimated* ums/uhs and hesitations from the mic audio (Chrome deletes ums from transcripts);
  - repeated sentence openers and the longest pause;
  - a one-line coaching tip;
  - a speech timeline showing voice activity, pauses, likely ums and pace for every 10 seconds.
- **Export:** *Download transcript* saves a `.txt` file with the topic, mode, transcript, stats,
  your prep notes and a suggested prompt. Paste it into Claude for feedback on content accuracy.

## Browser support

Built for **Google Chrome on desktop**. It relies on Chrome's built-in speech recognition
(`webkitSpeechRecognition`). Other browsers get a "please use Chrome" banner, but can still draw
topics and use the prep timer.

Chrome's recogniser streams audio to Google's speech service to produce the transcript. Everything
after that (fillers, pace, pauses) is computed locally in the page.

## Run locally

It's a static site with no build step. The microphone needs `localhost` or HTTPS, so serve the
folder rather than opening the file directly:

```bash
npx serve .              # or: python3 -m http.server 8080
```

Then open the printed URL in Chrome.

**Testing tip:** add `?prep=10&speech=15` to the URL to shorten the prep and speech timers (in
seconds).

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, then import the repo.
3. Leave the framework preset as **Other**, with no build command and the output directory as the
   repo root. Click **Deploy**.

`vercel.json` enables clean URLs and sends a `Permissions-Policy` header that allows the microphone
on the site's own origin. Nothing else is needed.

## Customising

| What                               | Where                                            |
| ---------------------------------- | ------------------------------------------------ |
| Filler words, phrases and rules    | `FILLER_WORDS` at the top of `js/config.js`      |
| Category weights and colours       | `CATEGORIES` in `js/config.js`                   |
| Prep and speech durations          | `MODES` and `SPEECH_SECONDS` in `js/config.js`   |
| Pace bands (slow/ideal/rushed)     | `PACE_BANDS` and `IDEAL_WPM` in `js/config.js`   |
| Topics                             | `js/topics.js` (one `[area, prompt]` per line)   |

Filler entries are case-insensitive and whole-word. Multi-word phrases are matched first, so
"okay so" is never also counted as "so". Words that are only fillers in some contexts take a rule:

```js
{ phrase: 'so', when: 'opener' }   // only at the start of a sentence or after a 0.3 s+ pause
{ phrase: 'like', when: 'like' }   // not "behaves like a wave", "particles like electrons", "I like"
{ phrase: 'just', possible: true } // counted, but labelled "possible"
```

## How the analysis works

Chrome's recogniser deletes most "um", "uh", "er" and "hmm" sounds before the page ever sees
them, so the analysis runs in three layers:

1. **Filler words (text).** These are matched in the transcript using the rules above. Chrome
   rarely adds punctuation on desktop, so "start of a sentence" means the start of a recognition
   segment (Chrome closes one each time you pause) or a word that follows a 0.3 s+ silence in the
   audio.
2. **Audio (estimated).** The page runs a Web Audio analyser on your mic alongside recognition,
   sampling speech-band energy (250 Hz–4 kHz) every 50 ms, with auto-gain turned off so quiet
   pauses stay quiet.
   - **Pauses and hesitations** are silences in that signal. *Hesitations* are silent gaps of
     0.4–2 s between your first and last word; longer ones count as long pauses.
   - **Likely um/uh** is where the mic heard voice but the recogniser returned no words. That
     covers a voiced stretch between pauses with no words, voice at the start or end of a stretch
     that no word accounts for, or a long gap in word arrivals while the audio stayed voiced. Each
     word is matched to the audio using Chrome's measured delay. Hissy sounds (breaths, clicks)
     are ignored, since "um" is a low murmur. This is a proxy, so it's always labelled
     "estimated".
3. **Patterns.** Repeated sentence openers (3+ sentences starting with the same word) and a
   one-line tip about your biggest crutch.

**Words per minute** is measured over the time you were actually talking, from the first sound to
the last. If the mic signal is ever too flat to read, pauses fall back to recogniser timing, which
misses anything under about a second. The results page and the transcript file both say which
source was used.

## Project structure

```
index.html        markup for all four screens (draw → prep → speak → results)
css/style.css     all styling and animation
js/config.js      user-editable settings (fillers, weights, durations)
js/topics.js      topic pools
js/main.js        app controller and screen flow
js/speech.js      Chrome speech recognition wrapper (auto-restarts, stitches the transcript)
js/audio.js       Web Audio: mic level monitor and synthesised chimes
js/analysis.js    pure functions: fillers, pauses, pace
js/charts.js      results graphics (gauge, timeline, filler bars)
js/visuals.js     starfield, category wheel, timer dials, voice visualiser, favicon
js/timer.js       drift-free countdown driven by a Web Worker
js/export.js      transcript .txt builder
vercel.json       static hosting headers
```
