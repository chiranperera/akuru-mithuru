// Curriculum: letters introduced in Tier 1 (vowels) and Tier 2 (consonants).
// Order matters — letters are introduced in this sequence in lessons.
// All consonants here carry the inherent "අ" vowel sound by default,
// so no pillam (vowel signs) are needed at this stage.

export const VOWELS = [
  { ch: 'අ', romanized: 'a' },
  { ch: 'ආ', romanized: 'aa' },
  { ch: 'ඇ', romanized: 'ae' },
  { ch: 'ඈ', romanized: 'aae' },
  { ch: 'ඉ', romanized: 'i' },
  { ch: 'ඊ', romanized: 'ii' },
  { ch: 'උ', romanized: 'u' },
  { ch: 'ඌ', romanized: 'uu' },
  { ch: 'එ', romanized: 'e' },
  { ch: 'ඒ', romanized: 'ee' },
  { ch: 'ඔ', romanized: 'o' },
  { ch: 'ඕ', romanized: 'oo' }
];

// Consonants in approximate frequency order — most-used first
// so she can read real words sooner.
export const CONSONANTS = [
  { ch: 'ක', romanized: 'ka' },
  { ch: 'ම', romanized: 'ma' },
  { ch: 'ප', romanized: 'pa' },
  { ch: 'ත', romanized: 'tha' },
  { ch: 'න', romanized: 'na' },
  { ch: 'ර', romanized: 'ra' },
  { ch: 'ල', romanized: 'la' },
  { ch: 'ස', romanized: 'sa' },
  { ch: 'ග', romanized: 'ga' },
  { ch: 'ද', romanized: 'dha' },
  { ch: 'ව', romanized: 'va' },
  { ch: 'හ', romanized: 'ha' },
  { ch: 'ය', romanized: 'ya' },
  { ch: 'බ', romanized: 'ba' },
  { ch: 'ට', romanized: 'Ta' },
  { ch: 'ඩ', romanized: 'Da' },
  { ch: 'ච', romanized: 'cha' },
  { ch: 'ජ', romanized: 'ja' }
];

export const ALL_LETTERS = [...VOWELS, ...CONSONANTS];

// Returns just the character strings for quick membership tests.
export const ALL_LETTER_CHARS = ALL_LETTERS.map(l => l.ch);

// Tier definitions — the structure of the curriculum.
export const TIERS = [
  {
    id: 1,
    name: 'ස්වර',
    nameEn: 'Vowels',
    type: 'letter',
    letters: VOWELS.map(v => v.ch)
  },
  {
    id: 2,
    name: 'ව්‍යඤ්ජන',
    nameEn: 'Consonants',
    type: 'letter',
    letters: CONSONANTS.map(c => c.ch)
  },
  {
    id: 3,
    name: 'අකුරු දෙකේ වචන',
    nameEn: 'Two-letter words',
    type: 'word',
    wordLength: 2
  },
  {
    id: 4,
    name: 'අකුරු තුනේ වචන',
    nameEn: 'Three-letter words',
    type: 'word',
    wordLength: 3
  }
];

// How many correct first-tries before a letter is considered "mastered".
export const MASTERY_THRESHOLD = 5;
