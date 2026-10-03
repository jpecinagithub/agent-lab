// Tool Factory: turns the visual Tool Builder form into a real registry entry.
// Custom handlers are authored as JavaScript source and compiled with the
// Function constructor in a deliberately narrow scope (args, context).
import { normalizeToolDef } from './registry.js';

const TYPE_MAP = { string: 'string', number: 'number', integer: 'integer', boolean: 'boolean', array: 'array', object: 'object' };

export function buildParametersSchema(params = []) {
  const properties = {};
  const required = [];
  for (const p of params) {
    if (!p.name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(p.name)) {
      throw new Error(`Invalid parameter name "${p.name}"`);
    }
    properties[p.name] = {
      type: TYPE_MAP[p.type] || 'string',
      description: p.description || ''
    };
    if (p.required) required.push(p.name);
  }
  const schema = { type: 'object', properties };
  if (required.length) schema.required = required;
  return schema;
}

export function compileHandler(source) {
  if (typeof source !== 'string' || !source.trim()) {
    return { ok: false, error: 'Handler source is empty.' };
  }
  try {
    // Narrow scope on purpose: handlers receive (args, context) and nothing else.
    const fn = new Function('args', 'context', `"use strict";\n${source}\n`);
    // Dry-run shape check is impossible without executing; validate at test time.
    return { ok: true, fn: async (args, context) => fn(args, context) };
  } catch (e) {
    return { ok: false, error: `Handler does not compile: ${e.message}` };
  }
}

export function createCustomTool({ name, description, params, handlerSource, risk = 'low', requiresApproval = false, category = 'custom' }) {
  if (!name || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)) {
    throw new Error('Tool name must start with a letter and contain only letters, numbers and underscores.');
  }
  const parameters = buildParametersSchema(params);
  const compiled = compileHandler(handlerSource);
  if (!compiled.ok) throw new Error(compiled.error);
  return normalizeToolDef({
    name,
    description: description || 'Custom user-built tool.',
    parameters,
    handler: compiled.fn,
    handlerSource,
    paramDefs: params,
    source: 'custom',
    enabled: true,
    risk,
    requiresApproval: requiresApproval || risk === 'high',
    category
  });
}

export function toolToBuilderJson(tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    source: tool.source,
    risk: tool.risk,
    requiresApproval: tool.requiresApproval,
    enabled: tool.enabled
  };
}

// Rehydrate persisted custom tools (functions cannot survive JSON, so we
// persist the source and recompile on load).
export function rehydrateCustomTool(stored) {
  return createCustomTool({
    name: stored.name,
    description: stored.description,
    params: stored.paramDefs || [],
    handlerSource: stored.handlerSource || 'return { ok: true };',
    risk: stored.risk || 'low',
    requiresApproval: stored.requiresApproval,
    category: stored.category || 'custom'
  });
}

export function serializeCustomTool(tool) {
  return {
    name: tool.name,
    description: tool.description,
    paramDefs: tool.paramDefs || [],
    handlerSource: tool.handlerSource || '',
    risk: tool.risk,
    requiresApproval: tool.requiresApproval,
    category: tool.category,
    enabled: tool.enabled
  };
}
