// Namespaced localStorage helpers with JSON safety.
const PREFIX = 'agentlab:';

export function storeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function storeSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storeRemove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}

export function sessionGet(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

export function sessionSet(key, value) {
  try { sessionStorage.setItem(PREFIX + key, String(value)); return true; }
  catch { return false; }
}

export function sessionRemove(key) {
  try { sessionStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}
