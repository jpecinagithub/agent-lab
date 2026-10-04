// Gmail OAuth via Google Identity Services (browser-only, no backend).
// Read-only scope. The access token lives in sessionStorage (this tab only)
// and is never written to disk. The Client ID is public by design — it only
// identifies the app to Google; it is not a secret.
import { sessionGet, sessionSet, sessionRemove } from '../utils/storage.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_KEY = 'gmail_oauth_token';

let gisPromise = null;
export function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google Identity Services failed to load.')));
    s.onerror = () => reject(new Error('Could not load Google Identity Services (network blocked?).'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('Timed out loading Google Identity Services.')), 20000);
  });
  return gisPromise;
}

function readToken() {
  try {
    const raw = sessionGet(TOKEN_KEY, null);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeToken(t) { sessionSet(TOKEN_KEY, JSON.stringify(t)); }
export function clearGmailToken() { sessionRemove(TOKEN_KEY); }

export function getValidGmailToken() {
  const t = readToken();
  if (!t || !t.access_token) return null;
  // 60s skew so we never send a token that is about to expire.
  if (t.expires_at && t.expires_at - 60000 < Date.now()) return null;
  return t.access_token;
}
export function isGmailConnected() { return Boolean(getValidGmailToken()); }

// Interactive connect — must be called from a user gesture (popup).
export async function connectGmailAccount(clientId) {
  if (!clientId) throw new Error('A Google OAuth Client ID is required. Paste it in Settings → Gmail.');
  await loadGis();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn) => (v) => { if (!settled) { settled = true; fn(v); } };
    try {
      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        callback: (resp) => {
          if (resp && resp.access_token) {
            const token = {
              access_token: resp.access_token,
              expires_at: Date.now() + (parseInt(resp.expires_in || '3600', 10) * 1000)
            };
            writeToken(token);
            done(resolve)(token);
          } else {
            done(reject)(new Error(resp?.error_description || resp?.error || 'Google sign-in was cancelled or failed.'));
          }
        },
        error_callback: (err) => done(reject)(new Error(err?.message || 'Google sign-in failed.'))
      });
      tc.requestAccessToken();
    } catch (e) {
      done(reject)(e);
    }
  });
}

// Best-effort silent refresh (no popup). Resolves null when user action is needed.
export async function silentlyRefreshGmailToken(clientId) {
  if (!clientId) return null;
  try { await loadGis(); } catch { return null; }
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GMAIL_SCOPE,
        prompt: 'none',
        callback: (resp) => {
          if (resp && resp.access_token) {
            const token = {
              access_token: resp.access_token,
              expires_at: Date.now() + (parseInt(resp.expires_in || '3600', 10) * 1000)
            };
            writeToken(token);
            done(token.access_token);
          } else {
            done(null);
          }
        },
        error_callback: () => done(null)
      });
      tc.requestAccessToken({ prompt: 'none' });
      setTimeout(() => done(null), 12000);
    } catch { done(null); }
  });
}
