// MemoryManager: single facade over short-term + long-term memory.
// Tools receive this via the executor context (tools never touch storage directly).
import { ShortTermMemory } from './shortTermMemory.js';
import { LongTermMemory } from './longTermMemory.js';
import { truncate } from '../utils/format.js';

export class MemoryManager {
  constructor() {
    this.shortTerm = new ShortTermMemory();
    this.longTerm = new LongTermMemory();
    this.listeners = new Set();
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) { try { fn(); } catch { /* noop */ } } }

  newRun(userRequest) {
    this.shortTerm.reset();
    this.shortTerm.userRequest = String(userRequest || '');
  }
  // --- long-term API (used by memory tools) ---
  remember(key, value, note) { const e = this.longTerm.remember(key, value, note, 'agent'); this.emit(); return e; }
  search(query, limit) { return this.longTerm.search(query, limit); }
  get(key) { return this.longTerm.get(key); }
  remove(key) { const n = this.longTerm.remove(key); this.emit(); return n; }
  clear() { const n = this.longTerm.clear(); this.emit(); return n; }
  list() { return this.longTerm.list(); }

  // Text injected into the model context: recent facts + facts relevant to the objective.
  buildMemoryText(objective = '', maxFacts = 8) {
    const parts = [];
    const recent = this.longTerm.list().slice(0, Math.min(4, maxFacts));
    if (recent.length) {
      parts.push('Recent remembered facts:');
      for (const e of recent) parts.push(`- ${e.key}: ${truncate(e.value, 160)}${e.note ? ` (${truncate(e.note, 80)})` : ''}`);
    }
    if (objective) {
      const relevant = this.longTerm.search(objective, 4).filter((e) => !recent.some((r) => r.key === e.key));
      if (relevant.length) {
        parts.push('Facts relevant to the current objective:');
        for (const e of relevant) parts.push(`- ${e.key}: ${truncate(e.value, 160)}`);
      }
    }
    return parts.join('\n');
  }
}
