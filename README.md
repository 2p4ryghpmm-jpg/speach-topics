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
- **Analysis (local, no API):** word count, words per minute, filler words (with a breakdown), the
  longest pause, and a speech timeline showing voice activity, pauses and pace for every 10 seconds.
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
| Filler words and phrases           | `FILLER_WORDS` in `js/config.js`                 |
| Category weights and colours       | `CATEGORIES` in `js/config.js`                   |
| Prep and speech durations          | `MODES` and `SPEECH_SECONDS` in `js/config.js`   |
| Pace bands (slow/ideal/rushed)     | `PACE_BANDS` and `IDEAL_WPM` in `js/config.js`   |
| Topics                             | `js/topics.js` (one `[area, prompt]` per line)   |

Filler entries can be plain strings (`'basically'`), phrases (`'you know'`), or objects that skip
obvious non-filler uses based on the word just before them:

```js
{ phrase: 'like', ignoreAfter: ['looks', 'something', 'behaves'] }  // "looks like a wave" isn't a filler
```

## How the analysis works

- **Words per minute** is measured over the time you were actually talking, from the first sound to
  the last. A slow start or finishing a few seconds early doesn't skew it.
- **Pauses** are found from the microphone's volume. The page samples the input level every 50 ms,
  estimates your room's noise floor and your speaking level, and treats stretches below the
  threshold as silence. It ignores tiny gaps between syllables and silence before your first word.
  If the mic signal is too flat to read, it falls back to the timing of the recogniser's results.
- **Filler words** are matched against the transcript. Chrome's recogniser often drops "um" and "uh",
  so treat those counts as a minimum.

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
