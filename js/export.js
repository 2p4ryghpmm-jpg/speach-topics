/*
 * Plain-text transcript export — built to be pasted straight into a Claude chat.
 */
import { fmtClock } from './timer.js';

const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

function row(label, value, width = 22) {
  return `${label} ${'.'.repeat(Math.max(2, width - label.length))} ${value}`;
}

function wrap(text, width = 76) {
  const out = [];
  for (const para of text.split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > width) { out.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * @param {{topic, categoryLabel, modeLine, date: Date, notes: string, stats}} s
 */
export function buildTranscript({ topic, categoryLabel, modeLine, date, notes, stats }) {
  const when = date.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const L = [];
  L.push('EXTEMPORE: ONE-MINUTE SPEECH TRANSCRIPT');
  L.push('='.repeat(44));
  L.push(`Topic:     ${topic.text}`);
  L.push(`Category:  ${categoryLabel} · ${topic.area}`);
  L.push(`Mode:      ${modeLine}`);
  L.push(`Recorded:  ${when}`);
  L.push(`Length:    ${fmtClock(stats.durationMs, { ceil: false })}`);
  L.push('');
  L.push('TRANSCRIPT');
  L.push('-'.repeat(44));
  L.push(stats.transcript ? wrap(stats.transcript) : '(no speech was recognised)');
  L.push('');
  L.push('(Auto-transcribed by Chrome speech recognition, so punctuation is approximate');
  L.push(' and occasional words may be misheard.)');
  L.push('');
  L.push('DELIVERY STATS');
  L.push('-'.repeat(44));
  L.push(row('Words spoken', String(stats.wordCount)));
  L.push(row('Pace', `${stats.wpm} words/min (${stats.pace.label.toLowerCase()})`));
  L.push(row('Speaking time', fmtClock(stats.speakingMs, { ceil: false })));
  L.push(row('Filler words', `${stats.fillers.total} (${stats.fillersPerMin.toFixed(1)} per min)`));
  for (const f of stats.fillers.counts) L.push(`    - "${f.phrase}" × ${f.count}`);
  if (stats.longestPauseMs != null) {
    L.push(row('Longest pause', `${secs(stats.longestPauseMs)} (at ${fmtClock(Math.round(stats.pauses.longest.start / 1000) * 1000)})`));
  } else {
    L.push(row('Longest pause', 'none detected'));
  }
  L.push(row('Pauses over 2 s', String(stats.longPauses)));
  if (stats.timeToFirstWordMs != null) L.push(row('Time to first word', secs(stats.timeToFirstWordMs)));
  const paced = stats.paceBuckets.filter((b) => b.end - b.start >= 5000);
  if (paced.length > 1) {
    L.push(row('Pace by 10 s', paced.map((b) => b.wpm).join(' · ') + ' wpm'));
  }
  if (notes && notes.trim()) {
    L.push('');
    L.push('MY PREP NOTES');
    L.push('-'.repeat(44));
    L.push(notes.trim());
  }
  L.push('');
  L.push('-'.repeat(44));
  L.push('Suggested prompt for Claude:');
  L.push(wrap(
    'Above is the transcript of a one-minute impromptu speech I gave on the topic shown. ' +
    'Please check it for factual accuracy, point out any misconceptions or oversimplifications, ' +
    'say what the strongest one-minute answer would have covered that I missed, ' +
    'and give me one concrete tip on structure.'
  ));
  L.push('');
  return L.join('\n');
}

function slug(text, max = 48) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .split(/\s+/)
    .reduce((acc, w) => (acc.length + w.length + 1 > max ? acc : acc ? `${acc}-${w}` : w), '');
}

export function transcriptFilename(topic, date) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `speech-${stamp}-${slug(topic.text.split(':')[0]) || 'topic'}.txt`;
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
