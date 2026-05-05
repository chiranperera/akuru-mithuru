// Lesson content selection.
//
// In the new free-navigation model, each tier has a fixed ordered list of items.
// The parent walks through them with prev/next arrows. The picker just exposes
// that ordered list; no random/weighted selection at the prompt level.

import { TWO_LETTER_WORDS, THREE_LETTER_WORDS, lettersInWord } from '../data/words.js';
import { TIERS } from '../data/letters.js';

// Returns the ordered list of items in a tier.
// Letter tiers => [{ type: 'letter', char }]
// Word tiers   => [{ type: 'word', word, letters: [...] }]
export function tierItems(tier) {
  if (tier.type === 'letter') {
    return tier.letters.map(ch => ({ type: 'letter', char: ch }));
  }
  const list = tier.wordLength === 2 ? TWO_LETTER_WORDS : THREE_LETTER_WORDS;
  return list.map(w => ({ type: 'word', word: w, letters: lettersInWord(w) }));
}

export function tierItemCount(tier) {
  return tierItems(tier).length;
}

// Map tier id → tier object (handy for routing).
export function tierById(id) {
  return TIERS.find(t => t.id === id) || TIERS[0];
}
