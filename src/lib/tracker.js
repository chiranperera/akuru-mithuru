// Per-letter stats and the mastery model.
//
// Each letter has a record:
//   { firstTry: int, retry: int, missed: int, mastered: bool }
// Mastery score = (firstTry + 0.75 * retry) / total — between 0 and 1.
// A letter is "mastered" once it has MASTERY_THRESHOLD first-try corrects
// AND its mastery score is >= 0.85.

import { ALL_LETTER_CHARS, MASTERY_THRESHOLD } from '../data/letters.js';

export function emptyLetterStat() {
  return { firstTry: 0, retry: 0, missed: 0, mastered: false };
}

export function ensureLetterStats(stats = {}) {
  // Make sure every curriculum letter has an entry.
  const out = { ...stats };
  for (const ch of ALL_LETTER_CHARS) {
    if (!out[ch]) out[ch] = emptyLetterStat();
  }
  return out;
}

export function recordFirstTryCorrect(stats, ch) {
  const s = stats[ch] || emptyLetterStat();
  s.firstTry++;
  if (s.firstTry >= MASTERY_THRESHOLD && masteryScore(s) >= 0.85) {
    s.mastered = true;
  }
  stats[ch] = s;
  return stats;
}

export function recordRetryCorrect(stats, ch) {
  const s = stats[ch] || emptyLetterStat();
  s.retry++;
  // Retry counts toward attempts but is partial credit, so it doesn't
  // automatically grant mastery.
  stats[ch] = s;
  return stats;
}

export function recordMissed(stats, ch) {
  const s = stats[ch] || emptyLetterStat();
  s.missed++;
  s.mastered = false; // a clean miss un-masters
  stats[ch] = s;
  return stats;
}

export function masteryScore(stat) {
  if (!stat) return 0;
  const total = stat.firstTry + stat.retry + stat.missed;
  if (total === 0) return 0;
  return (stat.firstTry + 0.75 * stat.retry) / total;
}

// Higher weight = more likely to surface. Untouched letters get medium weight
// (1.0) so they're introduced steadily; mastered letters get low weight; weak
// letters get high weight.
export function letterWeight(stat) {
  if (!stat || (stat.firstTry === 0 && stat.retry === 0 && stat.missed === 0)) {
    return 1.0;
  }
  if (stat.mastered) return 0.25;
  const score = masteryScore(stat);
  // Score 0.0 → weight 3.0; score 1.0 → weight 0.5
  return Math.max(0.5, 3.0 - 2.5 * score);
}

export function masteredCount(stats) {
  return Object.values(stats).filter(s => s && s.mastered).length;
}

export function isLetterIntroduced(stats, ch) {
  const s = stats[ch];
  if (!s) return false;
  return s.firstTry + s.retry + s.missed > 0;
}

// For the home screen / debug UI: return an array of [letter, score] sorted
// from weakest to strongest among introduced letters.
export function weakestFirst(stats, letters) {
  return letters
    .filter(ch => isLetterIntroduced(stats, ch))
    .map(ch => [ch, masteryScore(stats[ch])])
    .sort((a, b) => a[1] - b[1]);
}
