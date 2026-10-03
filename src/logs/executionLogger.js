// ExecutionLogger: append-only event log for a run. The trace view, the
// observability dashboard and history all read from this single source.
import { uid } from '../utils/id.js';

export class ExecutionLogger {
  constructor() { this.reset(); }
  reset(runId = null) {
    this.runId = runId || uid('run');
    this.events = [];
    this.seq = 0;
    this.startedAt = Date.now();
  }
  log(type, data = {}) {
    const ev = { seq: ++this.seq, ts: Date.now(), type, ...data };
    this.events.push(ev);
    return ev;
  }
  runStart(userRequest, mode) { return this.log('run_start', { userRequest, mode }); }
  stateChange(from, to) { return this.log('state_change', { from, to }); }
  objective(objective) { return this.log('objective', { objective }); }
  plan(plan, note) { return this.log('plan', { plan, note }); }
  llmCall(phase, model) { return this.log('llm_call', { phase, model }); }
  llmResponse(phase, summary) { return this.log('llm_response', { phase, summary }); }
  action(action) { return this.log('action', { action }); }
  toolStart(toolCall, tool, attempt = 0) {
    return this.log('tool_start', { toolCallId: toolCall.id, tool: tool.name, arguments: toolCall.arguments, reason: toolCall.reason, source: tool.source, simulated: tool.simulated, attempt });
  }
  toolEnd(toolCall, result) {
    return this.log('tool_end', { toolCallId: result.toolCallId, tool: result.tool, success: result.success, durationMs: Math.round(result.durationMs), retries: result.retries, simulated: result.simulated });
  }
  toolError(toolCall, info, extra = {}) {
    return this.log('tool_error', { toolCallId: toolCall.id || toolCall.toolCallId, tool: toolCall.tool || toolCall.name, info, ...extra });
  }
  observation(observation) {
    return this.log('observation', {
      toolCallId: observation.toolCallId, tool: observation.tool, success: observation.success,
      summary: observation.summary, simulated: observation.simulated
    });
  }
  approvalRequested(toolCall, tool) {
    return this.log('approval_requested', { toolCallId: toolCall.id, tool: tool.name, arguments: toolCall.arguments, risk: tool.risk });
  }
  approvalResolved(toolCall, approved, forRun = false) {
    return this.log('approval_resolved', { toolCallId: toolCall.id, approved, forRun });
  }
  decision(kind, detail) { return this.log('decision', { kind, detail }); }
  retry(info) { return this.log('retry', info); }
  guardrail(violation) { return this.log('guardrail', { violation }); }
  finalAnswer(text) { return this.log('final_answer', { text }); }
  runError(error) { return this.log('run_error', { error: String(error?.message || error), code: error?.code }); }
  runEnd(status, metrics) { return this.log('run_end', { status, metrics }); }

  getEvents() { return [...this.events]; }
  getTrace() { return this.getEvents(); }

  computeMetrics({ contextChars = 0, memoryEntries = 0 } = {}) {
    const ev = this.events;
    const count = (t) => ev.filter((e) => e.type === t).length;
    const toolEnds = ev.filter((e) => e.type === 'tool_end');
    const mcpCalls = toolEnds.filter((e) => e.simulated || String(e.source || '').startsWith('mcp')).length;
    const errors = count('tool_error') + count('run_error');
    const retries = ev.reduce((n, e) => n + (e.retries || 0), 0);
    const llmCalls = count('llm_call');
    const durationMs = (ev.length ? ev[ev.length - 1].ts : Date.now()) - this.startedAt;
    const iterations = ev.filter((e) => e.type === 'decision' && e.kind === 'iteration').length;
    // Token estimate: logged summaries are proxies; the runtime passes the real context size.
    const estTokens = Math.ceil(contextChars / 4) + llmCalls * 120;
    return {
      llmCalls, toolCalls: toolEnds.length, mcpCalls, iterations,
      durationMs, estTokens, errors, retries, memoryEntries, contextChars
    };
  }

  toJSON() {
    return { runId: this.runId, startedAt: this.startedAt, events: this.events };
  }
}
