// Home screen — streak, current tier, "Continue" button, mastered letters.

import { TIERS, VOWELS, CONSONANTS } from '../data/letters.js';
import { masteredCount } from '../lib/tracker.js';
import { suggestNextTier } from '../lib/picker.js';
import { tapClick } from '../lib/audio.js';
import { renderSignInButton, isSignedIn, decodeIdToken, getIdToken, signOut } from '../lib/auth.js';

export function renderHome(container, progress, onStartLesson) {
  const nextTier = suggestNextTier(progress);
  const totalMastered = masteredCount(progress.letterStats);
  const allLetters = [...VOWELS, ...CONSONANTS].length;
  const todayString = new Date().toISOString().slice(0, 10);
  const playedToday = progress.streak.lastPlayed === todayString;

  const parentInfo = decodeIdToken(getIdToken());
  const parentName = parentInfo?.given_name || parentInfo?.name?.split(' ')[0];

  container.innerHTML = `
    <div class="screen home" lang="si" translate="no">
      <header class="home-top" translate="no">
        <div class="streak ${progress.streak.count > 0 ? 'active' : ''}" aria-label="streak">
          <span class="streak-flame" translate="no">${progress.streak.count > 0 ? '🔥' : '✨'}</span>
          <span class="streak-count" translate="no">${progress.streak.count}</span>
        </div>
        <div class="parent-corner" translate="no">
          ${isSignedIn()
            ? `<span class="parent-name" translate="no">${escapeHtml(parentName || '')}</span>
               <button class="link-btn" id="signout-btn" translate="no">sign out</button>`
            : `<div id="signin-slot" translate="no"></div>`}
        </div>
      </header>

      <main class="home-main" translate="no">
        <h1 class="app-title sinhala" lang="si" translate="no">අකුරු මිතුරු</h1>

        <div class="tier-card" translate="no">
          <div class="tier-label" lang="si" translate="no">${nextTier.name}</div>
          <button class="big-btn primary continue-btn" id="continue-btn" lang="si" translate="no">
            පටන් ගමු
          </button>
          <div class="tier-sub" translate="no">Tier ${nextTier.id} • ${nextTier.nameEn}</div>
        </div>

        <div class="mastered-summary" translate="no">
          <div class="mastered-line" translate="no">
            <span class="mastered-num" translate="no">${totalMastered}</span>
            <span class="mastered-of" translate="no">/ ${allLetters}</span>
            <span class="mastered-label" lang="si" translate="no">අකුරු</span>
          </div>
          <div class="mastered-grid" translate="no">
            ${[...VOWELS, ...CONSONANTS].map(l => `
              <span class="mini-letter sinhala ${progress.letterStats[l.ch]?.mastered ? 'mastered' : ''}"
                    lang="si" translate="no">${l.ch}</span>
            `).join('')}
          </div>
        </div>

        ${!playedToday && progress.streak.count > 0 ? `
          <p class="hint" lang="si" translate="no">අද පාඩම තවම නැහැ! 🌟</p>
        ` : ''}
      </main>
    </div>
  `;

  if (!isSignedIn()) {
    const slot = container.querySelector('#signin-slot');
    if (slot) renderSignInButton(slot);
  } else {
    const out = container.querySelector('#signout-btn');
    if (out) out.addEventListener('click', () => { signOut(); location.reload(); });
  }

  const startBtn = container.querySelector('#continue-btn');
  startBtn.addEventListener('click', () => { tapClick(); onStartLesson(nextTier); });
  // Auto-focus for TV remote navigation.
  setTimeout(() => startBtn.focus(), 50);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
