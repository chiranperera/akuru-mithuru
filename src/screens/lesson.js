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

const FULL_WORD_DISPLAY_MS = 5000; // celebrate the completed word for 5s
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
let fullWordTimer = null;

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
  if (fullWordTimer) { clearTimeout(fullWordTimer); fullWordTimer = null; }
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

  const letters = currentItem.letters.map((ch, i) => {
    let cls;
    if (isFinal) {
      const r = wordLetterResults[i];
      cls = r === 'missed' ? 'final-wrong' : 'final-correct';
    } else if (i === letterIdx) {
      cls = 'active';
    } else if (i < letterIdx) {
      const r = wordLetterResults[i];
      cls = r === 'missed' ? 'wrong' : 'correct';
    } else {
      cls = 'pending';
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

  // Word: just finished last letter — celebrate the whole word.
  if (isWord && !showingFullWord) {
    showingFullWord = true;
    showCurrent();
    happyChime(); // a little reward for completing the word
    if (fullWordTimer) clearTimeout(fullWordTimer);
    fullWordTimer = setTimeout(() => {
      fullWordTimer = null;
      goToNextItem();
    }, FULL_WORD_DISPLAY_MS);
    return;
  }

  // Single letter, or full word already shown: move on.
  goToNextItem();
}

function goToNextItem() {
  if (fullWordTimer) { clearTimeout(fullWordTimer); fullWordTimer = null; }
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
  if (showingFullWord) {
    // Skip the celebration and step back.
    if (fullWordTimer) { clearTimeout(fullWordTimer); fullWordTimer = null; }
  }
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
    // Skip the celebration timer and advance.
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
  if (fullWordTimer) { clearTimeout(fullWordTimer); fullWordTimer = null; }
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

// ---- Keyboard ----

function lessonKeys(e) {
  if (!containerRef || !document.body.contains(containerRef)) return;
  if (containerRef.querySelector('.lesson-done')) return;

  // During the full-word celebration, any "advance"-like key skips early;
  // grading keys are no-ops.
  if (showingFullWord) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        e.preventDefault();
        nextItem();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        prevItem();
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        exitToHome();
        break;
    }
    return;
  }

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      onNo();
      break;
    case 'ArrowRight':
    case 'Enter':
    case ' ':
      e.preventDefault();
      onYes();
      break;
    case 'ArrowUp':
      e.preventDefault();
      prevItem();
      break;
    case 'ArrowDown':
      e.preventDefault();
      nextItem();
      break;
    case 'Escape':
    case 'Backspace':
      e.preventDefault();
      exitToHome();
      break;
  }
}

export function installKeyHandler() {
  document.removeEventListener('keydown', lessonKeys);
  document.addEventListener('keydown', lessonKeys);
}

export function uninstallKeyHandler() {
  document.removeEventListener('keydown', lessonKeys);
}
