export function fmtDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function fmtTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

export function fmtClock(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

export function truncate(str, max = 220) {
  if (str == null) return '';
  const s = String(str);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function safeJson(obj, indent = 2) {
  try {
    return JSON.stringify(obj, null, indent);
  } catch {
    return String(obj);
  }
}

export function tryParseJson(text) {
  if (typeof text !== 'string') return { ok: false, error: 'not a string' };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    // Try to salvage a JSON block embedded in prose (common LLM output)
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return { ok: true, value: JSON.parse(m[0]), salvaged: true }; } catch { /* fallthrough */ }
    }
    return { ok: false, error: e.message };
  }
}
