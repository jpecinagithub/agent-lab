// Guardrails: hard limits that keep the agent loop from running away.
// Checked by the runtime before every iteration.
export const DEFAULT_LIMITS = {
  maxIterations: 10,
  maxToolCalls: 25,
  timeoutMs: 180000, // whole-run timeout
  toolTimeoutMs: 30000,
  maxContextSize: 60000, // estimated chars; observations get trimmed beyond this
  maxRetries: 2
};

export function checkLimits({ iteration, toolCalls, elapsedMs, contextChars }, limits = {}) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const violations = [];
  if (iteration >= L.maxIterations) {
    violations.push({ code: 'MAX_ITERATIONS', message: `Reached maxIterations (${L.maxIterations}). Stopping to prevent an infinite loop.` });
  }
  if (toolCalls >= L.maxToolCalls) {
    violations.push({ code: 'MAX_TOOL_CALLS', message: `Reached maxToolCalls (${L.maxToolCalls}).` });
  }
  if (elapsedMs >= L.timeoutMs) {
    violations.push({ code: 'TIMEOUT', message: `Run exceeded the timeout of ${Math.round(L.timeoutMs / 1000)}s.` });
  }
  return { ok: violations.length === 0, violations, limits: L };
}

export function describeRisk(tool) {
  const map = {
    low: 'Low risk — reads data or computes locally. Runs without asking.',
    medium: 'Medium risk — changes local state. The harness logs it carefully.',
    high: 'High risk — external or destructive effect. Requires human approval.'
  };
  return map[tool?.risk] || map.low;
}
