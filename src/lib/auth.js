// Google Sign-In wrapper using Google Identity Services (GIS).
//
// Usage: call initAuth() once on app boot. It returns a promise that resolves
// once GIS is ready. Call signIn() to trigger the popup. The current ID token
// (or null if signed out) is available via getIdToken().

let idToken = null;
let listeners = [];
let clientId = null;

export async function initAuth(googleClientId) {
  clientId = googleClientId;
  if (!clientId) {
    console.warn('No GOOGLE_CLIENT_ID configured — running offline-only.');
    return;
  }
  await loadGisScript();

  return new Promise((resolve) => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: true,
      ux_mode: 'popup'
    });
    // Try silent sign-in (no UI if user already approved).
    window.google.accounts.id.prompt(() => {});
    resolve();
  });
}

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (document.getElementById('gis-script')) return resolve();
    const s = document.createElement('script');
    s.id = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

function handleCredentialResponse(response) {
  if (!response || !response.credential) return;
  idToken = response.credential;
  listeners.forEach(fn => {
    try { fn(idToken); } catch (err) { console.error(err); }
  });
}

export function getIdToken() {
  return idToken;
}

export function isSignedIn() {
  return !!idToken;
}

export function onAuthChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

// Render the "Sign in with Google" button into a container element.
export function renderSignInButton(container) {
  if (!clientId || !window.google?.accounts?.id) {
    container.innerHTML = '<p class="hint">Sign-in unavailable — check setup.</p>';
    return;
  }
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_blue',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    locale: 'en'
  });
}

export function signOut() {
  idToken = null;
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  listeners.forEach(fn => { try { fn(null); } catch {} });
}

// Decode the JWT payload (no verification — backend handles that).
// Useful only for display purposes (showing the parent's name).
export function decodeIdToken(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
