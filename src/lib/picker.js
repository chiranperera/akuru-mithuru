// Lesson content selection.
//
// For LETTER tiers (Tier 1 vowels, Tier 2 consonants):
//   - Take the first N un-mastered letters from the tier.
//   - Weight each prompt selection by letter weight so weak letters surface
//     more often within a single lesson.
//
// For WORD tiers (Tier 3 two-letter, Tier 4 three-letter):
//   - Filter the curated list to words composed only of letters the kid has
//     been introduced to in earlier tiers.
//   - Score each word by the sum of its letters' weights.
//   - Pick the highest-scoring N words for the lesson, with a little
//     randomness so consecutive lessons aren't identical.

import { TWO_LETTER_WORDS, THREE_LETTER_WORDS, lettersInWord } from '../data/words.js';
import { TIERS, VOWELS, CONSONANTS, ALL_LETTER_CHARS } from '../data/letters.js';
import { letterWeight, isLetterIntroduced, masteryScore } from './tracker.js';

const PROMPTS_PER_LESSON = 8;

export function pickLetterLesson(tier, stats) {
  const letters = tier.letters;
  // Pool: prefer un-mastered letters; if all are mastered, refresh with all.
  const unmastered = letters.filter(ch => !(stats[ch] && stats[ch].mastered));
  const pool = unmastered.length ? unmastered : letters;

  // Build weighted prompt list — repeat each letter according to its weight.
  const prompts = [];
  for (let i = 0; i < PROMPTS_PER_LESSON; i++) {
    prompts.push(weightedPick(pool, stats));
  }
  return prompts.map(ch => ({ type: 'letter', char: ch }));
}

export function pickWordLesson(tier, stats) {
  const list = tier.wordLength === 2 ? TWO_LETTER_WORDS : THREE_LETTER_WORDS;
  // Only include words whose every letter has been introduced.
  const eligible = list.filter(word =>
    lettersInWord(word).every(ch => isLetterIntroduced(stats, ch) || ALL_LETTER_CHARS.includes(ch))
  );
  // For the very first word lesson, the kid won't have stats on letters yet
  // beyond the consonants tier — but they ARE introduced because Tier 2
  // marked them. So eligible should be the full list once Tier 2 is done.

  // Score: sum of letter weights, plus a small random jitter.
  const scored = eligible.map(word => {
    const score = lettersInWord(word).reduce(
      (sum, ch) => sum + letterWeight(stats[ch]),
      0
    );
    return { word, score: score + Math.random() * 0.4 };
  });

  scored.sort((a, b) => b.score - a.score);
  const count = tier.wordsPerLesson || 5;
  return scored.slice(0, count).map(w => ({
    type: 'word',
    word: w.word,
    letters: lettersInWord(w.word)
  }));
}

// Weighted random choice from `pool` based on each letter's weight.
function weightedPick(pool, stats) {
  const weights = pool.map(ch => letterWeight(stats[ch]));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Decide what tier the kid should start on this session, given their progress.
export function suggestNextTier(progress) {
  const stats = progress.letterStats || {};
  const vowelMastery = countMastered(stats, VOWELS.map(v => v.ch)) / VOWELS.length;
  const consonantMastery = countMastered(stats, CONSONANTS.map(c => c.ch)) / CONSONANTS.length;

  if (vowelMastery < 0.7) return TIERS[0];   // Tier 1
  if (consonantMastery < 0.7) return TIERS[1]; // Tier 2
  // After both letter tiers reach 70% mastery, alternate between word tiers
  // weighted toward the weaker.
  const t3Done = progress.completedLessons?.tier3 || 0;
  const t4Done = progress.completedLessons?.tier4 || 0;
  if (consonantMastery < 0.85 || t3Done < 5) return TIERS[2]; // keep on 2-letter
  return Math.random() < 0.6 ? TIERS[2] : TIERS[3];
}

function countMastered(stats, chars) {
  return chars.filter(ch => stats[ch] && stats[ch].mastered).length;
}
