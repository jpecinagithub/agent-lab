// The Tool Executor: the ONLY path through which any tool runs.
// Pipeline: locate -> enabled? -> validate args -> permissions -> execute
// (with timeout + retries) -> normalize -> log -> observation-ready result.
// The LLM never executes tools directly; it only requests them.
import { validateArguments } from './validator.js';
import { shortId } from '../utils/id.js';

export const MAX_RETRIES = 2;

function isRecoverable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return /timeout|timed out|network|econn|temporar|rate|unavailable|abort/i.test(msg);
}

function normalizeResult(toolCall, { success, data = null, error = null, durationMs = 0, retries = 0, simulated = false }) {
  let safeData = data;
  try { JSON.stringify(safeData); } catch { safeData = { _unserializable: String(safeData) }; }
  return {
    toolCallId: toolCall.id || shortId('call'),
    tool: toolCall.tool,
    success,
    data: safeData,
    error: error ? String(error?.message || error) : null,
    durationMs,
    retries,
    simulated,
    timestamp: Date.now()
  };
}

export async function executeToolCall({
  registry,
  permissionManager,
  toolCall,
  context = {},
  logger = null,
  timeoutMs = 30000,
  runId = null,
  onApproval = null // async (approval) => boolean
}) {
  const started = performance.now();
  const call = {
    id: toolCall.id || shortId('call'),
    tool: toolCall.tool,
    arguments: toolCall.arguments || {},
    reason: toolCall.reason || '',
    source: toolCall.source || 'agent'
  };
  const fail = (error, extra = {}) =>
    normalizeResult(call, { success: false, error, durationMs: performance.now() - started, ...extra });

  // 1. locate
  const tool = registry.get(call.tool);
  if (!tool) {
    const r = fail(`Unknown tool "${call.tool}". It is not in the registry.`);
    logger?.toolError(call, r);
    return r;
  }
  // 2. enabled?
  if (!tool.enabled) {
    const r = fail(`Tool "${call.tool}" is registered but currently disabled.`);
    logger?.toolError(call, r);
    return r;
  }
  // 3. validate arguments
  const validation = validateArguments(tool, call.arguments);
  if (!validation.ok) {
    const r = fail(`Invalid arguments for "${call.tool}": ${validation.errors.join('; ')}`);
    logger?.toolError(call, r, { phase: 'validation' });
    return r;
  }
  // 4. permissions
  const perm = permissionManager.canExecute(tool, call.arguments, runId);
  if (!perm.allowed) {
    const r = fail(`Permission denied for "${call.tool}": ${perm.reason}`);
    logger?.toolError(call, r, { phase: 'permission' });
    return r;
  }
  if (perm.requiresApproval) {
    if (typeof onApproval !== 'function') {
      const r = fail(`Tool "${call.tool}" requires human approval, but no approval handler is wired.`);
      logger?.toolError(call, r, { phase: 'approval' });
      return r;
    }
    logger?.approvalRequested(call, tool);
    const approved = await onApproval({ toolCall: call, tool, reason: perm.reason });
    logger?.approvalResolved(call, approved);
    if (!approved) {
      const r = fail(`Human denied approval for "${call.tool}".`);
      logger?.toolError(call, r, { phase: 'approval' });
      return r;
    }
  }
  // 5. execute with timeout + retries
  if (typeof tool.handler !== 'function') {
    const r = fail(`Tool "${call.tool}" has no executable handler registered.`);
    logger?.toolError(call, r, { phase: 'locate' });
    return r;
  }
  let lastError = null;
  let retries = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      logger?.toolStart(call, tool, attempt);
      const data = await tool.handler(call.arguments, { ...context, signal: controller.signal, toolName: tool.name });
      clearTimeout(timer);
      const r = normalizeResult(call, {
        success: true,
        data: data ?? null,
        durationMs: performance.now() - started,
        retries,
        simulated: tool.simulated === true
      });
      logger?.toolEnd(call, r);
      return r;
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      const recoverable = isRecoverable(e) || e?.name === 'AbortError';
      logger?.toolError(call, { error: String(e?.message || e), attempt }, { phase: 'execute' });
      if (recoverable && attempt < MAX_RETRIES) {
        retries++;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  const r = fail(lastError, { retries, simulated: tool.simulated === true });
  return r;
}
