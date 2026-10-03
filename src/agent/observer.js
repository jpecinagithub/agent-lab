// Observer: STEP 5. Converts a raw tool result into an Observation — the exact
// object appended to the agent context and sent back to the model.
import { truncate } from '../utils/format.js';
import { shortId } from '../utils/id.js';

function summarizeData(tool, data) {
  if (data == null) return 'Tool returned no data.';
  if (typeof data === 'string') return truncate(data, 300);
  if (typeof data === 'number' || typeof data === 'boolean') return `Result: ${data}`;
  if (Array.isArray(data)) return `${data.length} item(s) returned.`;
  if (typeof data === 'object') {
    if (data.result !== undefined && Object.keys(data).length <= 4) {
      return `Result: ${truncate(JSON.stringify(data.result), 200)}`;
    }
    if (data.summary) return truncate(String(data.summary), 300);
    if (data.count !== undefined) return `${data.count} record(s) returned.`;
    if (data.text) return truncate(String(data.text), 300);
    const keys = Object.keys(data).slice(0, 5).join(', ');
    return `Object returned with fields: ${keys || '(empty)'}.`;
  }
  return 'Tool completed.';
}

export function createObservation(toolResult, toolCall) {
  const summary = toolResult.success
    ? summarizeData(toolResult.tool, toolResult.data)
    : `Tool failed: ${toolResult.error || 'unknown error'}`;
  return {
    toolCallId: toolResult.toolCallId || toolCall?.id || shortId('call'),
    tool: toolResult.tool,
    request: { tool: toolResult.tool, arguments: toolCall?.arguments || {} },
    reason: toolCall?.reason || '',
    success: toolResult.success,
    summary,
    data: toolResult.data ?? null,
    error: toolResult.error ?? null,
    durationMs: Math.round(toolResult.durationMs || 0),
    retries: toolResult.retries || 0,
    simulated: toolResult.simulated === true,
    timestamp: Date.now()
  };
}
