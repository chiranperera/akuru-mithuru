// Home screen — 4 tier cards. Each card shows progress and a reset option.
// Click a card (or press Enter while focused) to start that tier.

import { TIERS, VOWELS, CONSONANTS } from '../data/letters.js';
import { masteredCount } from '../lib/tracker.js';
import { tierItemCount } from '../lib/picker.js';
import { getTierIndex, resetTier, saveLocal, queueCloudPush } from '../lib/storage.js';
import { tapClick } from '../lib/audio.js';
import {
  renderSignInButton, isSignedIn, decodeIdToken, getIdToken, signOut
} from '../lib/auth.js';

let onPickTier = null;
let onAfterReset = null;
let progressRef = null;
let containerRef = null;

export function renderHome(container, progress, callbacks) {
  containerRef = container;
  progressRef = progress;
  onPickTier = callbacks.onPickTier;
  onAfterReset = callbacks.onAfterReset || (() => {});

  const totalLetters = VOWELS.length + CONSONANTS.length;
  const totalMastered = masteredCount(progress.letterStats);
  const today = new Date().toISOString().slice(0, 10);
  const playedToday = progress.streak.lastPlayed === today;

  const parentInfo = decodeIdToken(getIdToken());
  const parentName = parentInfo?.given_name || parentInfo?.name?.split(' ')[0];

  container.innerHTML = `
    <div class="screen home" lang="si" translate="no">
      <header class="home-top" translate="no">
        <div class="streak ${progress.streak.count > 0 ? 'active' : ''}" translate="no">
          <span class="streak-flame" translate="no">${progress.streak.count > 0 ? '🔥' : '✨'}</span>
          <span class="streak-count" translate="no">${progress.streak.count}</span>
        </div>
        <h1 class="app-title sinhala" lang="si" translate="no">අකුරු මිතුරු</h1>
        <div class="parent-corner" translate="no">
          ${isSignedIn()
            ? `<span class="parent-name" translate="no">${escapeHtml(parentName || '')}</span>
               <button class="link-btn" id="signout-btn" translate="no">sign out</button>`
            : `<div id="signin-slot" translate="no"></div>`}
        </div>
      </header>

      <main class="home-main" translate="no">
        <div class="tier-grid" translate="no">
          ${TIERS.map(t => renderTierCard(t, progress)).join('')}
        </div>
      </main>

      <footer class="home-foot" translate="no">
        <div class="overall-mastered" translate="no">
          <span class="mastered-num" translate="no">${totalMastered}</span>
          <span class="mastered-of" translate="no">/ ${totalLetters}</span>
          <span class="mastered-label" lang="si" translate="no">අකුරු</span>
        </div>
        ${!playedToday && progress.streak.count > 0 ? `
          <p class="hint" lang="si" translate="no">අද පාඩම තවම නැහැ! 🌟</p>
        ` : ''}
      </footer>
    </div>
  `;

  if (!isSignedIn()) {
    const slot = container.querySelector('#signin-slot');
    if (slot) renderSignInButton(slot);
  } else {
    container.querySelector('#signout-btn')?.addEventListener('click', () => {
      signOut(); location.reload();
    });
  }

  // Wire up each tier card.
  container.querySelectorAll('.tier-card').forEach(card => {
    const tierId = parseInt(card.dataset.tierId, 10);
    const continueBtn = card.querySelector('.tier-continue');
    const resetBtn = card.querySelector('.tier-reset');

    continueBtn.addEventListener('click', () => {
      tapClick();
      onPickTier(TIERS.find(t => t.id === tierId));
    });

    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tapClick();
      confirmReset(tierId);
    });
  });

  // Default focus on the first tier's Continue button so TV remote Enter
  // jumps right in.
  setTimeout(() => {
    const first = container.querySelector('.tier-card .tier-continue');
    if (first) first.focus();
  }, 50);

  installKeyHandler();
}

function renderTierCard(tier, progress) {
  const total = tierItemCount(tier);
  const idx = Math.min(getTierIndex(progress, tier.id), total);
  const pct = total ? Math.round((idx / total) * 100) : 0;
  const masteredHere = tier.type === 'letter' && tier.letters
    ? tier.letters.filter(ch => progress.letterStats[ch]?.mastered).length
    : null;
  const buttonLabel = idx === 0 ? 'පටන් ගමු' : 'ඉදිරියට';

  return `
    <article class="tier-card" data-tier-id="${tier.id}" translate="no">
      <div class="tier-card-head" translate="no">
        <div class="tier-card-title">
          <span class="tier-num" translate="no">${tier.id}</span>
          <span class="tier-name sinhala" lang="si" translate="no">${tier.name}</span>
        </div>
        <button class="tier-reset"
                aria-label="reset tier ${tier.id}"
                title="Reset tier"
                translate="no">↺</button>
      </div>

      <div class="tier-progress" translate="no">
        <div class="tier-progress-bar" style="width: ${pct}%"></div>
      </div>
      <div class="tier-progress-text" translate="no">
        <span translate="no">${idx} / ${total}</span>
        ${masteredHere !== null
          ? `<span class="dot" translate="no">·</span>
             <span class="mastered-here" translate="no">${masteredHere} mastered</span>`
          : ''}
      </div>

      <button class="big-btn primary tier-continue" lang="si" translate="no">${buttonLabel}</button>
    </article>
  `;
}

function confirmReset(tierId) {
  const tier = TIERS.find(t => t.id === tierId);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" translate="no">
      <h2 class="modal-title sinhala" lang="si" translate="no">Reset?</h2>
      <p class="modal-body" translate="no">
        Reset progress for <strong lang="si" class="sinhala" translate="no">${escapeHtml(tier.name)}</strong>?
        ${tier.type === 'letter'
          ? 'This clears the letter stats for this tier and starts from the first letter.'
          : 'This rewinds to the first word.'}
      </p>
      <div class="modal-actions" translate="no">
        <button class="big-btn secondary" id="modal-cancel" translate="no">Cancel</button>
        <button class="big-btn danger" id="modal-confirm" translate="no">Reset</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cancel = overlay.querySelector('#modal-cancel');
  const confirm = overlay.querySelector('#modal-confirm');
  cancel.focus();

  function close() {
    overlay.remove();
    installKeyHandler();
  }
  cancel.addEventListener('click', () => { tapClick(); close(); });
  confirm.addEventListener('click', () => {
    tapClick();
    resetTier(progressRef, tierId);
    saveLocal(progressRef);
    queueCloudPush(progressRef, getIdToken());
    close();
    onAfterReset(tierId);
  });

  // Modal-specific keyboard handler.
  document.removeEventListener('keydown', keyHandler);
  function modalKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); cancel.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); cancel.focus(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); confirm.focus(); }
  }
  document.addEventListener('keydown', modalKeys);
  // Make sure when modal closes, our normal handler comes back.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      document.removeEventListener('keydown', modalKeys);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

// ---- Keyboard navigation between tier cards ----

function keyHandler(e) {
  // Only handle when the home screen is in DOM (focus is inside #app).
  if (!containerRef || !document.body.contains(containerRef)) return;
  const cards = Array.from(containerRef.querySelectorAll('.tier-card'));
  if (!cards.length) return;
  const active = document.activeElement;
  const activeCard = active?.closest('.tier-card');
  const idx = activeCard ? cards.indexOf(activeCard) : -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = cards[Math.min(cards.length - 1, idx + 1)] || cards[0];
    next.querySelector('.tier-continue')?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const next = cards[Math.max(0, idx - 1)] || cards[0];
    next.querySelector('.tier-continue')?.focus();
  } else if (e.key === 'ArrowRight') {
    if (activeCard) {
      e.preventDefault();
      activeCard.querySelector('.tier-reset')?.focus();
    }
  } else if (e.key === 'ArrowLeft') {
    if (activeCard && active.classList.contains('tier-reset')) {
      e.preventDefault();
      activeCard.querySelector('.tier-continue')?.focus();
    }
  } else if (e.key === 'Enter' || e.key === ' ') {
    // Default browser behavior activates the focused button — no override.
  }
}

export function installKeyHandler() {
  document.removeEventListener('keydown', keyHandler);
  document.addEventListener('keydown', keyHandler);
}

export function uninstallKeyHandler() {
  document.removeEventListener('keydown', keyHandler);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
