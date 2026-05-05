// Local-first storage with optional cloud sync.
//
// Strategy:
//   1. On boot, load from localStorage so the app is instantly usable.
//   2. If a Google ID token is present, fetch /api/progress and merge.
//   3. After any mutation, write to localStorage immediately and queue a
//      debounced push to /api/progress.
//
// The storage shape lives in localStorage under the key STORAGE_KEY.

import { ensureLetterStats } from './tracker.js';

const STORAGE_KEY = 'akuru-mithuru:v1';
const SCHEMA_VERSION = 1;
const PUSH_DEBOUNCE_MS = 1500;

export function emptyProgress() {
  return {
    version: SCHEMA_VERSION,
    appName: 'අකුරු මිතුරු',
    currentTier: 1,
    completedLessons: { tier1: 0, tier2: 0, tier3: 0, tier4: 0 },
    letterStats: ensureLetterStats({}),
    wordsSeen: [],
    streak: { count: 0, lastPlayed: null },
    unlockedTiers: [1],
    updatedAt: new Date().toISOString()
  };
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (err) {
    console.warn('Failed to load local progress, starting fresh:', err);
    return emptyProgress();
  }
}

export function saveLocal(progress) {
  progress.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

function migrate(progress) {
  if (!progress || typeof progress !== 'object') return emptyProgress();
  const base = emptyProgress();
  const merged = { ...base, ...progress };
  merged.letterStats = ensureLetterStats(progress.letterStats || {});
  merged.completedLessons = { ...base.completedLessons, ...(progress.completedLessons || {}) };
  merged.streak = { ...base.streak, ...(progress.streak || {}) };
  if (!Array.isArray(merged.unlockedTiers)) merged.unlockedTiers = [1];
  if (!Array.isArray(merged.wordsSeen)) merged.wordsSeen = [];
  return merged;
}

// ---- Cloud sync ----

let pushTimer = null;

export async function fetchCloud(idToken) {
  if (!idToken) return null;
  try {
    const res = await fetch('/api/progress', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (res.status === 404) return null; // no cloud record yet
    if (!res.ok) throw new Error(`progress fetch failed: ${res.status}`);
    const json = await res.json();
    return migrate(json.progress || json);
  } catch (err) {
    console.warn('Cloud fetch failed (continuing offline):', err);
    return null;
  }
}

export function queueCloudPush(progress, idToken) {
  if (!idToken) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushCloud(progress, idToken), PUSH_DEBOUNCE_MS);
}

export async function pushCloud(progress, idToken) {
  if (!idToken) return;
  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ progress })
    });
    if (!res.ok) {
      console.warn('Cloud push failed:', res.status);
    }
  } catch (err) {
    console.warn('Cloud push failed (will retry on next change):', err);
  }
}

// Merge local and cloud — keep whichever is more recent. Letter stats merge
// per-letter taking the higher counts.
export function mergeProgress(local, cloud) {
  if (!cloud) return local;
  if (!local) return cloud;
  const localTime = new Date(local.updatedAt || 0).getTime();
  const cloudTime = new Date(cloud.updatedAt || 0).getTime();
  // Take the newer base.
  const base = cloudTime > localTime ? cloud : local;
  const other = cloudTime > localTime ? local : cloud;
  // But always take the max counters per letter (so progress is never lost).
  const stats = {};
  for (const ch of new Set([
    ...Object.keys(base.letterStats || {}),
    ...Object.keys(other.letterStats || {})
  ])) {
    const a = base.letterStats?.[ch] || { firstTry: 0, retry: 0, missed: 0, mastered: false };
    const b = other.letterStats?.[ch] || { firstTry: 0, retry: 0, missed: 0, mastered: false };
    stats[ch] = {
      firstTry: Math.max(a.firstTry, b.firstTry),
      retry: Math.max(a.retry, b.retry),
      missed: Math.max(a.missed, b.missed),
      mastered: a.mastered || b.mastered
    };
  }
  return { ...base, letterStats: ensureLetterStats(stats) };
}
