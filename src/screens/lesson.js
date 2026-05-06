// Lesson screen — free navigation through a tier's items.
//
// Layout:
//   ┌─[‹]────────[N/M]────[home]────[›]─┐
//   │                                    │
//   │             [BIG LETTER]           │
//   │   or for words: [ක ම ල] (active)   │
//   │                                    │
//   │        ( ✗ )       ( ✓ )           │
//   └────────────────────────────────────┘
//
// Word lessons walk through letters left-to-right. Each letter is graded
// individually; correct ones tint green at 0.2 opacity, missed ones tint
// red. After the last letter, the whole word is shown at full opacity in
// its result colors for FULL_WORD_DISPLAY_MS, then we advance.
//
// TV remote keys (no focus dance — every key does one thing):
//   ArrowLeft  → ✗
//   ArrowRight / Enter / Space → ✓
//   ArrowUp    → previous item
//   ArrowDown  → next item
//   Escape / Backspace → home

import { tierItems } from '../lib/picker.js';
import { getTierIndex, setTierIndex } from '../lib/storage.js';
import {
  recordFirstTryCorrect, recordRetryCorrect, recordMissed
} from '../lib/tracker.js';
import {
  happyChime, softChime, failChime, celebrationFanfare, tapClick
} from '../lib/audio.js';

const ADVANCE_DELAY_MS = 700;       // pause after each grade so colors register

let currentTier = null;
let currentItem = null;
let items = [];
let itemIdx = 0;
let letterIdx = 0;        // for word items: which letter inside the word
let attempt = 1;           // 1 = first try, 2 = retry
let progressRef = null;
let containerRef = null;
let onLessonExitCb = null;
let onPersistCb = null;
let inFlight = false;
let wordLetterResults = []; // per-letter results for the current word
let letterResult = null;    // result for current single letter
let showingFullWord = false;

export function renderLesson(container, tier, progress, callbacks) {
  containerRef = container;
  currentTier = tier;
  progressRef = progress;
  onLessonExitCb = callbacks.onLessonExit || (() => {});
  onPersistCb = callbacks.onPersist || (() => {});

  items = tierItems(tier);
  itemIdx = Math.min(getTierIndex(progress, tier.id), items.length);
  if (itemIdx >= items.length) itemIdx = 0;

  resetItemState();
  installKeyHandler();
  showCurrent();
}

function resetItemState() {
  letterIdx = 0;
  attempt = 1;
  wordLetterResults = [];
  letterResult = null;
  showingFullWord = false;
}

// ---- Rendering ----

function showCurrent() {
  if (!items.length) return;
  if (itemIdx >= items.length) {
    showCelebration();
    return;
  }
  currentItem = items[itemIdx];
  const total = items.length;
  const isWord = currentItem.type === 'word';

  containerRef.innerHTML = `
    <div class="screen lesson" translate="no">
      <header class="lesson-top" translate="no">
        <button class="nav-arrow nav-prev" id="nav-prev" aria-label="previous" translate="no">‹</button>
        <div class="lesson-meta" translate="no">
          <span class="meta-pos" translate="no">${itemIdx + 1} / ${total}</span>
          <button class="link-btn home-btn" id="home-btn" lang="si" translate="no">ගෙදර</button>
        </div>
        <button class="nav-arrow nav-next" id="nav-next" aria-label="next" translate="no">›</button>
      </header>

      <main class="lesson-main" translate="no">
        ${attempt === 2 && !showingFullWord ? `
          <p class="retry-hint" lang="si" translate="no">බලන්න, හරියට!</p>
        ` : ''}
        ${isWord ? renderWord() : renderSingleLetter()}
      </main>

      <footer class="lesson-foot ${showingFullWord ? 'dim' : ''}" translate="no">
        <button class="grade-btn no" id="btn-no" aria-label="wrong" translate="no" ${showingFullWord ? 'disabled' : ''}>✗</button>
        <button class="grade-btn yes" id="btn-yes" aria-label="correct" translate="no" ${showingFullWord ? 'disabled' : ''}>✓</button>
      </footer>
    </div>
  `;

  containerRef.querySelector('#btn-yes').addEventListener('click', onYes);
  containerRef.querySelector('#btn-no').addEventListener('click', onNo);
  containerRef.querySelector('#nav-prev').addEventListener('click', prevItem);
  containerRef.querySelector('#nav-next').addEventListener('click', nextItem);
  containerRef.querySelector('#home-btn').addEventListener('click', exitToHome);

  // Focus ✓ so Enter on remote = correct (only when grading is active).
  if (!showingFullWord) {
    setTimeout(() => containerRef.querySelector('#btn-yes')?.focus(), 30);
  }
}

function renderSingleLetter() {
  const ch = currentItem.char;
  const resultCls = letterResult ? `result-${letterResult}` : '';
  const sizeCls = attempt === 2 ? 'huge' : '';
  return `
    <div class="big-letter sinhala ${sizeCls} ${resultCls}" lang="si" translate="no">${ch}</div>
  `;
}

function renderWord() {
  const isFinal = showingFullWord;
  const wrapCls = [
    'word-display sinhala',
    attempt === 2 && !isFinal ? 'retry-mode' : '',
    isFinal ? 'word-final' : ''
  ].filter(Boolean).join(' ');

  // Color logic:
  //   isFinal           → every letter at full opacity in its result color.
  //   i === letterIdx   → active letter (dark, bold).
  //   has stored result → faded green or faded red (held even if user
  //                       navigates back/forward without re-grading).
  //   else              → pending (gray, faded).
  const letters = currentItem.letters.map((ch, i) => {
    let cls;
    if (isFinal) {
      const r = wordLetterResults[i];
      cls = r === 'missed' ? 'final-wrong' : 'final-correct';
    } else if (i === letterIdx) {
      cls = 'active';
    } else {
      const r = wordLetterResults[i];
      if (r === 'missed') cls = 'wrong';
      else if (r === 'correct') cls = 'correct';
      else cls = 'pending';
    }
    return `<span class="word-letter ${cls}" lang="si" translate="no">${ch}</span>`;
  }).join('');

  return `<div class="${wrapCls}" lang="si" translate="no">${letters}</div>`;
}

// ---- Grading ----

function onYes() {
  if (inFlight || showingFullWord) return;
  tapClick();
  happyChime();
  flash('correct');
  paintCurrentResult(attempt === 1 ? 'correct' : 'correct');
  recordResult(attempt === 1 ? 'first' : 'retry');
  scheduleAdvance(ADVANCE_DELAY_MS);
}

function onNo() {
  if (inFlight || showingFullWord) return;
  tapClick();
  if (attempt === 1) {
    softChime();
    attempt = 2;
    showCurrent();
  } else {
    failChime();
    flash('missed');
    paintCurrentResult('wrong');
    recordResult('missed');
    scheduleAdvance(ADVANCE_DELAY_MS);
  }
}

// Tint the current letter in green/red so the result is visible during the
// brief pause before advancing.
function paintCurrentResult(kind) {
  if (currentItem.type === 'word') {
    // Already handled via wordLetterResults rendering on next paint;
    // we just push the result so the next render shows it.
    wordLetterResults[letterIdx] = kind === 'wrong' ? 'missed' : 'correct';
  } else {
    letterResult = kind === 'wrong' ? 'wrong' : 'correct';
    // Re-render the big letter with the result class.
    const el = containerRef.querySelector('.big-letter');
    if (el) {
      el.classList.remove('result-correct', 'result-wrong');
      el.classList.add(`result-${letterResult}`);
    }
  }
}

function recordResult(kind) {
  const isWord = currentItem.type === 'word';
  const ch = isWord ? currentItem.letters[letterIdx] : currentItem.char;
  if (kind === 'first') recordFirstTryCorrect(progressRef.letterStats, ch);
  else if (kind === 'retry') recordRetryCorrect(progressRef.letterStats, ch);
  else if (kind === 'missed') recordMissed(progressRef.letterStats, ch);
  if (isWord && !progressRef.wordsSeen.includes(currentItem.word)) {
    progressRef.wordsSeen.push(currentItem.word);
  }
  onPersistCb();
}

function scheduleAdvance(ms) {
  inFlight = true;
  setTimeout(() => {
    inFlight = false;
    advance();
  }, ms);
}

function advance() {
  attempt = 1;
  const isWord = currentItem.type === 'word';

  // Word: walk to next letter.
  if (isWord && letterIdx < currentItem.letters.length - 1) {
    letterIdx++;
    showCurrent();
    return;
  }

  // Word: just finished last letter — show the whole word in result colors.
  // No auto-advance — parent presses Down/Right to move to the next word.
  if (isWord && !showingFullWord) {
    showingFullWord = true;
    showCurrent();
    happyChime(); // a little reward for completing the word
    return;
  }

  // Single letter, or full word already shown: move on.
  goToNextItem();
}

function goToNextItem() {
  resetItemState();
  itemIdx++;
  setTierIndex(progressRef, currentTier.id, itemIdx);
  onPersistCb();
  if (itemIdx >= items.length) {
    showCelebration();
  } else {
    showCurrent();
  }
}

// ---- Navigation ----

function prevItem() {
  if (inFlight || attempt === 2) return;
  if (itemIdx > 0) {
    itemIdx--;
    resetItemState();
    setTierIndex(progressRef, currentTier.id, itemIdx);
    onPersistCb();
    tapClick();
    showCurrent();
  }
}

function nextItem() {
  if (inFlight) return;
  if (showingFullWord) {
    goToNextItem();
    return;
  }
  if (attempt === 2) return;
  if (itemIdx < items.length - 1) {
    itemIdx++;
    resetItemState();
    setTierIndex(progressRef, currentTier.id, itemIdx);
    onPersistCb();
    tapClick();
    showCurrent();
  } else {
    showCelebration();
  }
}

function exitToHome() {
  uninstallKeyHandler();
  tapClick();
  onLessonExitCb();
}

// ---- Celebration on tier completion ----

function showCelebration() {
  celebrationFanfare();
  containerRef.innerHTML = `
    <div class="screen lesson-done" translate="no">
      <div class="celebration" translate="no">🎉</div>
      <p class="result-line" lang="si" translate="no">හරිම ලස්සනයි!</p>
      <p class="result-stats" translate="no">${currentTier.nameEn} complete</p>
      <div class="done-actions" translate="no">
        <button class="big-btn primary" id="back-home" lang="si" translate="no">ගෙදර</button>
        <button class="big-btn secondary" id="restart-tier" lang="si" translate="no">නැවතත්</button>
      </div>
    </div>
  `;
  const back = containerRef.querySelector('#back-home');
  const restart = containerRef.querySelector('#restart-tier');
  back.addEventListener('click', () => { tapClick(); exitToHome(); });
  restart.addEventListener('click', () => {
    tapClick();
    itemIdx = 0;
    resetItemState();
    setTierIndex(progressRef, currentTier.id, 0);
    onPersistCb();
    showCurrent();
  });
  setTimeout(() => back.focus(), 80);
}

// ---- Visual flash overlay ----

function flash(kind) {
  const el = document.createElement('div');
  el.className = `flash ${kind}`;
  el.textContent = kind === 'correct' ? '✓' : '✗';
  containerRef.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// ---- Within-word letter navigation ----
//
// For word items, Left/Right move the active letter pointer back/forward
// inside the word. Going past either end advances to the next/previous word.

function prevLetter() {
  if (inFlight || attempt === 2) return;
  if (currentItem?.type !== 'word') {
    prevItem();
    return;
  }
  if (showingFullWord) {
    // Step back into the word at the last letter.
    showingFullWord = false;
    letterIdx = currentItem.letters.length - 1;
    tapClick();
    showCurrent();
    return;
  }
  if (letterIdx > 0) {
    letterIdx--;
    tapClick();
    showCurrent();
  } else {
    prevItem();
  }
}

function nextLetter() {
  if (inFlight || attempt === 2) return;
  if (currentItem?.type !== 'word') {
    nextItem();
    return;
  }
  if (showingFullWord) {
    nextItem();
    return;
  }
  if (letterIdx < currentItem.letters.length - 1) {
    letterIdx++;
    tapClick();
    showCurrent();
  } else {
    // At last letter — drop into the full-word celebration view.
    showingFullWord = true;
    showCurrent();
  }
}

// ---- Keyboard ----
//
// Bind both `e.key` (modern) and `e.keyCode` (legacy) because Samsung
// Tizen TV browsers populate keyCode for some remote buttons but leave
// e.key empty.
//
//   Up                          → previous item (letter or word)
//   Down                        → next item (letter or word)
//   Left                        → previous letter inside current word
//   Right                       → next letter inside current word
//
//   OK / Enter / Space          → ✓ correct
//   Back / Backspace            → ✗ wrong
//
//   B  (Green button)           → ✓ correct
//   A  (Red button)             → ✗ wrong
//   C  (Yellow button)          → home
//   D  (Blue button)            → (unbound)
//
// Samsung Tizen keyCode reference:
//   Red=403, Green=404, Yellow=405, Blue=406, Return/Back=10009.
// Standard keys ('Enter', 'Backspace', 'Arrow*', 'Escape') work on all
// browsers including Samsung's.

const YES_KEYS  = new Set([
  'Enter', ' ', 'y', 'Y', '2',
  'F2', 'b', 'B', 'ColorF1Green'
]);
const NO_KEYS   = new Set([
  'Backspace', 'n', 'N', '1',
  'F1', 'a', 'A', 'ColorF0Red'
]);
const HOME_KEYS = new Set([
  'Escape',
  'F3', 'c', 'C', 'ColorF2Yellow'
]);

// Samsung Tizen-specific numeric keyCodes for buttons whose `e.key`
// often comes through as an empty string in the TV browser.
const SAMSUNG_RED    = 403;
const SAMSUNG_GREEN  = 404;
const SAMSUNG_YELLOW = 405;
const SAMSUNG_BLUE   = 406;
const SAMSUNG_RETURN = 10009;

function lessonKeys(e) {
  if (!containerRef || !document.body.contains(containerRef)) return;
  if (containerRef.querySelector('.lesson-done')) return;

  // 1. Samsung Tizen color buttons + Back button — checked by keyCode
  //    because e.key is unreliable on Tizen for these.
  switch (e.keyCode) {
    case SAMSUNG_RED:
      e.preventDefault();
      if (!showingFullWord) onNo();
      return;
    case SAMSUNG_GREEN:
      e.preventDefault();
      if (showingFullWord) nextItem();
      else onYes();
      return;
    case SAMSUNG_YELLOW:
      e.preventDefault();
      exitToHome();
      return;
    case SAMSUNG_BLUE:
      e.preventDefault();
      // Reserved for future use.
      return;
    case SAMSUNG_RETURN:
      e.preventDefault();
      if (!showingFullWord) onNo();
      else exitToHome();
      return;
  }

  // 2. Standard keys (work on all browsers).
  if (HOME_KEYS.has(e.key)) {
    e.preventDefault();
    exitToHome();
    return;
  }
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); prevItem();   return;
    case 'ArrowDown':  e.preventDefault(); nextItem();   return;
    case 'ArrowLeft':  e.preventDefault(); prevLetter(); return;
    case 'ArrowRight': e.preventDefault(); nextLetter(); return;
  }
  if (YES_KEYS.has(e.key)) {
    e.preventDefault();
    if (showingFullWord) nextItem();
    else onYes();
    return;
  }
  if (NO_KEYS.has(e.key)) {
    e.preventDefault();
    if (!showingFullWord) onNo();
    return;
  }
}

export function installKeyHandler() {
  document.removeEventListener('keydown', lessonKeys);
  document.addEventListener('keydown', lessonKeys);
}

export function uninstallKeyHandler() {
  document.removeEventListener('keydown', lessonKeys);
}
