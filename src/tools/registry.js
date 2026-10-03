// Central Tool Registry. The LLM only ever sees name/description/parameters;
// the harness maps those names to real JavaScript handlers here.
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export function normalizeToolDef(def) {
  if (!def || typeof def !== 'object') throw new Error('Tool definition must be an object');
  if (!NAME_RE.test(def.name)) throw new Error(`Invalid tool name "${def.name}". Use letters, numbers and underscores, starting with a letter.`);
  return {
    name: def.name,
    description: def.description || '',
    parameters: def.parameters || { type: 'object', properties: {} },
    handler: def.handler || null,
    source: def.source || 'native', // 'native' | 'custom' | 'mcp:<server>'
    enabled: def.enabled !== false,
    risk: def.risk || 'low', // low | medium | high
    requiresApproval: Boolean(def.requiresApproval),
    category: def.category || 'general',
    simulated: Boolean(def.simulated),
    readOnly: Boolean(def.readOnly),
    createdAt: def.createdAt || Date.now()
  };
}

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.listeners = new Set();
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) { try { fn(this.list()); } catch { /* noop */ } } }

  register(def) {
    const tool = normalizeToolDef(def);
    this.tools.set(tool.name, tool);
    this.emit();
    return tool;
  }
  unregister(name) {
    const existed = this.tools.delete(name);
    if (existed) this.emit();
    return existed;
  }
  get(name) { return this.tools.get(name) || null; }
  has(name) { return this.tools.has(name); }
  list() { return [...this.tools.values()]; }
  listEnabled() { return this.list().filter((t) => t.enabled); }
  setEnabled(name, enabled) {
    const t = this.get(name);
    if (!t) return false;
    t.enabled = Boolean(enabled);
    this.emit();
    return true;
  }
  countBySource() {
    const counts = { native: 0, custom: 0, mcp: 0 };
    for (const t of this.tools.values()) {
      if (t.source === 'native') counts.native++;
      else if (t.source === 'custom') counts.custom++;
      else if (String(t.source).startsWith('mcp:')) counts.mcp++;
    }
    return counts;
  }
  // What the model is allowed to see: schemas only, never implementations.
  toSchemas() {
    return this.listEnabled().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      source: t.source,
      enabled: t.enabled
    }));
  }
}
