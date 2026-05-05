// Curated grade-1 Sinhala words built only from base consonants (no pillam).
// Each consonant carries the inherent "අ" vowel sound by default.
// Edit data/words.md for human-readable list with English meanings.

// Two-letter words (Tier 3) — every letter is one of the consonants in CONSONANTS.
export const TWO_LETTER_WORDS = [
  'කට',  // mouth
  'කද',  // trunk
  'කර',  // shoulder / do
  'කල',  // period
  'ගස',  // tree
  'ගල',  // stone
  'ගත',  // took
  'ජය',  // victory
  'තල',  // sesame
  'දම',  // chain
  'නම',  // name
  'නල',  // tube / whistle
  'පත',  // leaf
  'පල',  // fruit / result
  'පස',  // soil / back
  'බල',  // look / strength
  'බර',  // heavy
  'මග',  // way / road
  'මල',  // flower
  'මස',  // month / flesh
  'රට',  // country
  'රන',  // gold
  'රස',  // taste
  'ලද',  // got / received
  'වල',  // pits / holes
  'වර',  // turn / time
  'සත',  // true / cent
  'සර',  // sound / essence
  'හස',  // smile
  'හත'   // seven
];

// Three-letter words (Tier 4) — pillam-free.
// These are rarer in Sinhala (most 3-letter words use pillam),
// so this list is shorter. The picker repeats them deliberately.
export const THREE_LETTER_WORDS = [
  'පහන',   // lamp
  'සතය',   // truth
  'කමල',   // lotus (also a name)
  'රජය',   // kingdom
  'ජනය',   // people
  'බලය',   // power
  'ගමන',   // journey
  'වසර',   // year
  'රහස',   // secret
  'තරග',   // competition
  'සරල',   // simple
  'මනස',   // mind
  'මතය',   // opinion
  'වදන',   // word
  'පදය',   // verse
  'රසය',   // taste (the noun form)
  'සමර',   // recall / battle
  'කතර',   // desert
  'පතල',   // flat / mine
  'දරව'    // (filler — replace if not desired)
];

// Build a quick lookup of what letters appear in each word, for the picker.
export function lettersInWord(word) {
  // Split into individual graphemes. For the words above (no pillam, no
  // zero-width joiners), each letter is a single Unicode code point.
  return Array.from(word);
}
