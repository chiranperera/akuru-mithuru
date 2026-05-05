// Main entry point. Routes between home and lesson; persists progress;
// merges cloud progress on sign-in.

import {
  renderHome, installKeyHandler as installHomeKeys, uninstallKeyHandler as uninstallHomeKeys
} from './screens/home.js';
import { renderLesson } from './screens/lesson.js';
import {
  loadLocal, saveLocal, fetchCloud, queueCloudPush, mergeProgress
} from './lib/storage.js';
import { initAuth, onAuthChange, getIdToken } from './lib/auth.js';

let progress = loadLocal();
const root = document.getElementById('app');

async function boot() {
  let googleClientId = null;
  try {
    const res = await fetch('/api/config');
    if (res.ok) googleClientId = (await res.json()).googleClientId;
  } catch (err) {
    console.warn('Could not load /api/config — running offline-only:', err);
  }

  await initAuth(googleClientId);

  onAuthChange(async (token) => {
    if (token) {
      const cloud = await fetchCloud(token);
      if (cloud) {
        progress = mergeProgress(progress, cloud);
        saveLocal(progress);
        queueCloudPush(progress, token);
      } else {
        queueCloudPush(progress, token);
      }
    }
    goHome();
  });

  goHome();
}

function goHome() {
  bumpStreakIfNewDay();
  uninstallHomeKeys();
  renderHome(root, progress, {
    onPickTier: startTier,
    onAfterReset: () => goHome()
  });
}

function startTier(tier) {
  uninstallHomeKeys();
  renderLesson(root, tier, progress, {
    onLessonExit: () => goHome(),
    onPersist: persist
  });
}

function bumpStreakIfNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  const last = progress.streak.lastPlayed;
  if (last === today) return;
  if (!last) {
    progress.streak.count = 1;
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    progress.streak.count = last === yesterday ? progress.streak.count + 1 : 1;
  }
  progress.streak.lastPlayed = today;
  persist();
}

function persist() {
  saveLocal(progress);
  const token = getIdToken();
  if (token) queueCloudPush(progress, token);
}

// Service worker for offline support.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

boot();
