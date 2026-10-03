// Long-term memory: persistent facts, preferences and run summaries.
// Stored in localStorage (key: agentlab:longterm). Survives reloads.
import { storeGet, storeSet } from '../utils/storage.js';

const KEY = 'longterm';

export class LongTermMemory {
  constructor() {
    this.entries = storeGet(KEY, []);
    if (!Array.isArray(this.entries)) this.entries = [];
  }
  persist() { storeSet(KEY, this.entries); }

  remember(key, value, note = '', source = 'agent') {
    const k = String(key).trim();
    if (!k) throw new Error('Memory key cannot be empty.');
    const now = Date.now();
    const existing = this.entries.find((e) => e.key.toLowerCase() === k.toLowerCase());
    if (existing) {
      existing.value = String(value);
      existing.note = note || existing.note;
      existing.updatedAt = now;
      this.persist();
      return existing;
    }
    const entry = { key: k, value: String(value), note: String(note || ''), source, createdAt: now, updatedAt: now };
    this.entries.push(entry);
    this.persist();
    return entry;
  }
  get(key) {
    return this.entries.find((e) => e.key.toLowerCase() === String(key).toLowerCase()) || null;
  }
  search(query, limit = 5) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return this.entries.slice(-limit).reverse();
    const terms = q.split(/\s+/);
    const scored = this.entries.map((e) => {
      const hay = `${e.key} ${e.value} ${e.note}`.toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += t.length > 3 ? 2 : 1;
      return { e, score };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.e);
  }
  remove(key) {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.key.toLowerCase() !== String(key).toLowerCase());
    this.persist();
    return before - this.entries.length;
  }
  clear() {
    const n = this.entries.length;
    this.entries = [];
    this.persist();
    return n;
  }
  list() { return [...this.entries].sort((a, b) => b.updatedAt - a.updatedAt); }
  count() { return this.entries.length; }
}
