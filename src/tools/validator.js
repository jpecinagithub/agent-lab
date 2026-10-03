// Argument validation against a JSON-Schema subset.
// The harness validates BEFORE executing — a bad call never reaches the handler.
function checkType(value, type) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'null': return value === null;
    default: return true;
  }
}

function validateValue(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((t) => checkType(value, t))) {
    errors.push(`${path}: expected ${types.join('|')}, got ${Array.isArray(value) ? 'array' : typeof value}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path}: too short (min ${schema.minLength})`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path}: too long (max ${schema.maxLength})`);
    if (schema.pattern) { try { if (!new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match pattern`); } catch { /* bad pattern */ } }
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((v, i) => validateValue(v, schema.items, `${path}[${i}]`, errors));
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items`);
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (value[k] !== undefined) validateValue(value[k], sub, `${path}.${k}`, errors);
    }
  }
}

export function validateArguments(toolDef, args) {
  const errors = [];
  const schema = toolDef.parameters || { type: 'object', properties: {} };
  if (args == null || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, errors: ['arguments must be an object'] };
  }
  const required = schema.required || [];
  for (const key of required) {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      errors.push(`missing required argument: "${key}"`);
    }
  }
  const props = schema.properties || {};
  for (const [key, value] of Object.entries(args)) {
    if (props[key]) validateValue(value, props[key], key, errors);
    // unknown extra args are tolerated (models sometimes add them)
  }
  if (schema.type === 'object' && schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!props[key]) errors.push(`unknown argument: "${key}"`);
    }
  }
  return { ok: errors.length === 0, errors };
}
