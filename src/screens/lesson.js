// Lesson runner — handles both single-letter prompts and word prompts.
// A word prompt walks the kid through each letter in sequence with the
// surrounding word visible.

import {
  recordFirstTryCorrect,
  recordRetryCorrect,
  recordMissed
} from '../lib/tracker.js';
import { happyChime, softChime, celebrationFanfare, tapClick } from '../lib/audio.js';

export function renderLesson(container, prompts, progress, onLessonDone) {
  let i = 0;
  const totalPrompts = prompts.length;
  let promptResults = [];

  function next() {
    if (i >= prompts.length) {
      finishLesson();
      return;
    }
    const p = prompts[i];
    if (p.type === 'letter') {
      runLetterPrompt(container, p.char, null, (result) => {
        applyResult(p.char, result);
        promptResults.push({ char: p.char, result });
        i++;
        next();
      });
    } else if (p.type === 'word') {
      runWordPrompt(container, p, (perLetterResults) => {
        for (const r of perLetterResults) {
          applyResult(r.char, r.result);
          promptResults.push(r);
        }
        i++;
        next();
      });
    }
  }

  function applyResult(ch, result) {
    if (result === 'first') recordFirstTryCorrect(progress.letterStats, ch);
    else if (result === 'retry') recordRetryCorrect(progress.letterStats, ch);
    else if (result === 'missed') recordMissed(progress.letterStats, ch);
  }

  function finishLesson() {
    celebrationFanfare();
    const firsts = promptResults.filter(r => r.result === 'first').length;
    const retries = promptResults.filter(r => r.result === 'retry').length;
    const total = promptResults.length;
    const stars = total === 0 ? 0 : firsts / total >= 0.85 ? 3 : firsts / total >= 0.6 ? 2 : 1;
    container.innerHTML = `
      <div class="screen lesson-done" translate="no">
        <div class="celebration" translate="no">🎉</div>
        <div class="stars" translate="no" aria-label="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <p class="result-line" lang="si" translate="no">හරිම ලස්සනයි!</p>
        <p class="result-stats" translate="no">${firsts} first try · ${retries} on retry · ${total - firsts - retries} missed</p>
        <button class="big-btn primary" id="back-home" lang="si" translate="no">ගෙදර</button>
      </div>
    `;
    const back = container.querySelector('#back-home');
    back.addEventListener('click', () => { tapClick(); onLessonDone(promptResults); });
    setTimeout(() => back.focus(), 80);
  }

  // Top-level lesson chrome: progress bar + back button.
  container.innerHTML = `<div class="screen lesson" id="lesson-root" translate="no"></div>`;
  next();
}

// ---- Single-letter prompt ----

function runLetterPrompt(container, ch, contextWord, done) {
  let attempt = 1; // 1 = first try, 2 = retry

  function show(big = false, hint = null) {
    const root = container;
    root.innerHTML = `
      <div class="screen lesson" translate="no">
        ${contextWord ? `
          <div class="context-word sinhala" lang="si" translate="no">
            ${contextWord.letters.map((c, idx) => `
              <span class="ctx-letter ${c === ch && idx === contextWord.activeIndex ? 'active' : ''}
                    ${idx < contextWord.activeIndex ? 'done' : ''}"
                    lang="si" translate="no">${c}</span>
            `).join('')}
          </div>
        ` : ''}
        <div class="prompt-area ${attempt === 2 ? 'retry-mode' : ''}" translate="no">
          ${attempt === 2 ? `
            <p class="retry-hint" lang="si" translate="no">බලන්න, හරියට!</p>
          ` : ''}
          <div class="big-letter sinhala ${big ? 'huge' : ''}" lang="si" translate="no">${ch}</div>
        </div>
        <div class="judge-row" translate="no">
          <button class="judge-btn no" id="btn-no" aria-label="wrong" translate="no">✗</button>
          <button class="judge-btn yes" id="btn-yes" aria-label="correct" translate="no">✓</button>
        </div>
      </div>
    `;
    container.querySelector('#btn-yes').addEventListener('click', onYes);
    container.querySelector('#btn-no').addEventListener('click', onNo);
    setTimeout(() => container.querySelector('#btn-yes').focus(), 30);
  }

  function onYes() {
    tapClick();
    happyChime();
    flash(container, 'correct');
    setTimeout(() => done(attempt === 1 ? 'first' : 'retry'), 600);
  }

  function onNo() {
    tapClick();
    if (attempt === 1) {
      // Enter retry mode: show the correct letter even bigger.
      softChime();
      attempt = 2;
      show(true);
    } else {
      // Already retried — count as missed and move on.
      flash(container, 'missed');
      setTimeout(() => done('missed'), 500);
    }
  }

  show(false);
}

// ---- Word prompt: walk through letters in sequence ----

function runWordPrompt(container, prompt, done) {
  const { word, letters } = prompt;
  const results = [];
  let idx = 0;

  function nextLetter() {
    if (idx >= letters.length) {
      // Whole word done.
      const anyMissed = results.some(r => r.result === 'missed');
      if (!anyMissed) {
        flashWord(container, word, 'correct');
        setTimeout(() => done(results), 700);
      } else {
        // Word marked as failed — but per-letter tracking already recorded
        // each letter's individual result. Move on.
        setTimeout(() => done(results), 400);
      }
      return;
    }
    const letter = letters[idx];
    runLetterPrompt(
      container,
      letter,
      { letters, activeIndex: idx },
      (result) => {
        results.push({ char: letter, result });
        idx++;
        nextLetter();
      }
    );
  }

  nextLetter();
}

// ---- Visual flash for feedback ----

function flash(container, kind) {
  const el = document.createElement('div');
  el.className = `flash ${kind}`;
  el.textContent = kind === 'correct' ? '✓' : '✗';
  container.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function flashWord(container, word, kind) {
  const el = document.createElement('div');
  el.className = `flash ${kind} word-flash sinhala`;
  el.lang = 'si';
  el.setAttribute('translate', 'no');
  el.textContent = word;
  container.appendChild(el);
  setTimeout(() => el.remove(), 700);
}
