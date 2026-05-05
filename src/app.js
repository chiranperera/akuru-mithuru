// Main entry point. Boots storage, auth, then renders the home screen.
// Listens for sign-in to merge cloud progress, and pushes changes back.

import { renderHome } from './screens/home.js';
import { renderLesson } from './screens/lesson.js';
import { pickLetterLesson, pickWordLesson } from './lib/picker.js';
import {
  loadLocal, saveLocal, fetchCloud, queueCloudPush, mergeProgress
} from './lib/storage.js';
import { initAuth, onAuthChange, getIdToken } from './lib/auth.js';

let progress = loadLocal();
const root = document.getElementById('app');

async function boot() {
  // Fetch the public client ID from our serverless config endpoint.
  let googleClientId = null;
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const json = await res.json();
      googleClientId = json.googleClientId;
    }
  } catch (err) {
    console.warn('Could not load /api/config — running offline-only:', err);
  }

  await initAuth(googleClientId);

  onAuthChange(async (token) => {
    if (token) {
      // Just signed in — pull cloud and merge.
      const cloud = await fetchCloud(token);
      if (cloud) {
        progress = mergeProgress(progress, cloud);
        saveLocal(progress);
        // Push the merged result back so cloud has the canonical version.
        queueCloudPush(progress, token);
      } else {
        // No cloud record yet — push our local up.
        queueCloudPush(progress, token);
      }
      goHome();
    } else {
      goHome();
    }
  });

  goHome();
}

function goHome() {
  // Update streak on each visit to home.
  bumpStreakIfNewDay();
  renderHome(root, progress, startLesson);
}

function startLesson(tier) {
  let prompts;
  if (tier.type === 'letter') {
    prompts = pickLetterLesson(tier, progress.letterStats);
  } else {
    prompts = pickWordLesson(tier, progress.letterStats);
  }
  renderLesson(root, prompts, progress, onLessonDone(tier));
}

function onLessonDone(tier) {
  return (results) => {
    // Record lesson completion.
    const key = `tier${tier.id}`;
    progress.completedLessons[key] = (progress.completedLessons[key] || 0) + 1;
    // Add words seen, if any.
    for (const r of results) {
      if (r.word && !progress.wordsSeen.includes(r.word)) {
        progress.wordsSeen.push(r.word);
      }
    }
    persist();
    goHome();
  };
}

function bumpStreakIfNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  const last = progress.streak.lastPlayed;
  if (last === today) return; // already counted today
  if (!last) {
    progress.streak.count = 1;
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (last === yesterday) progress.streak.count++;
    else progress.streak.count = 1;
  }
  progress.streak.lastPlayed = today;
  persist();
}

function persist() {
  saveLocal(progress);
  const token = getIdToken();
  if (token) queueCloudPush(progress, token);
}

// Arrow-key focus management for TV remotes.
document.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return;
  const focusables = Array.from(document.querySelectorAll(
    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
  if (!focusables.length) return;
  const idx = focusables.indexOf(document.activeElement);
  let nextIdx = idx;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = Math.min(focusables.length - 1, idx + 1);
  if (nextIdx === idx) return;
  e.preventDefault();
  focusables[nextIdx].focus();
});

// Service worker for offline support.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

boot();
