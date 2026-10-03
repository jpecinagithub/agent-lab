// AgentRuntime: owns the centralized agent state machine and orchestrates the
// whole run. React subscribes to its events; it never stores agent state in
// scattered component state.
import { STATES, STATE_META, canTransition, createInitialAgentState } from './agentState.js';
import { buildContext } from './contextManager.js';
import { runPlanningPhase } from './planner.js';
import { runAgentLoop, StopError } from './agentLoop.js';
import { createSimulatedAdapter } from '../llm/simulatedBrain.js';
import { createQwenAdapter } from '../llm/modelAdapter.js';
import { QwenClient } from '../llm/qwenClient.js';
import { DEFAULT_LIMITS } from '../security/guardrails.js';
import { uid } from '../utils/id.js';
import { sessionGet } from '../utils/storage.js';

class Emitter {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.map.get(evt)?.delete(fn);
  }
  emit(evt, payload) {
    for (const fn of this.map.get(evt) || []) { try { fn(payload); } catch (e) { console.error('event handler error', e); } }
  }
}

export class AgentRuntime extends Emitter {
  constructor({ registry, memory, skills, permissions, logger, getSettings, onRunEnd }) {
    super();
    this.registry = registry;
    this.memory = memory;
    this.skills = skills;
    this.permissions = permissions;
    this.logger = logger;
    this.getSettings = getSettings;
    this.onRunEnd = onRunEnd;
    this.agentState = createInitialAgentState();
    this.limits = { ...DEFAULT_LIMITS };
    this.paused = false;
    this.stepMode = false;
    this.stopped = false;
    this._gateResolve = null;
    this._resumeState = null;
    this.pendingApproval = null;
    this.sessionConversation = [];
    this.adapter = null;
    this.adapterSimulated = true;
    this.startedAt = null;
    this._lastContextChars = 0;
    this.currentRunMeta = null;
  }

  // ---------- state ----------
  _applyState(s) {
    const from = this.agentState.state;
    this.agentState.previousState = from;
    this.agentState.state = s;
    this.agentState.updatedAt = Date.now();
    this.logger.stateChange(from, s);
    this.emit('state', { from, to: s, meta: STATE_META[s] });
  }
  setState(next) {
    const from = this.agentState.state;
    if (!canTransition(from, next)) {
      this.emit('notice', { kind: 'warn', text: `Unexpected state transition ${from} → ${next}; allowing it.` });
    }
    this._applyState(next);
  }
  get state() { return this.agentState.state; }
  get stateMeta() { return STATE_META[this.agentState.state]; }

  throwIfStopped() {
    if (this.stopped) throw new StopError();
  }

  // Pause/step gate. Called at stage boundaries by the loop.
  async checkpoint(kind) {
    this.throwIfStopped();
    if (this.stepMode || this.paused) {
      this._resumeState = this.agentState.state;
      this._applyState(STATES.PAUSED);
      this.emit('checkpoint', { kind });
      await new Promise((resolve) => { this._gateResolve = resolve; });
      this._gateResolve = null;
      this.throwIfStopped();
      const back = this._resumeState && this._resumeState !== STATES.PAUSED ? this._resumeState : STATES.SELECTING_ACTION;
      this._applyState(back);
      this._resumeState = null;
    }
  }

  pause() {
    if ([STATES.COMPLETED, STATES.FAILED, STATES.STOPPED, STATES.IDLE].includes(this.agentState.state)) return;
    this.paused = true;
    this.emit('notice', { kind: 'info', text: 'Pause requested — the harness will halt at the next stage boundary.' });
  }
  resume() {
    this.paused = false;
    if (this._gateResolve) this._gateResolve();
  }
  step() {
    if (this._gateResolve) { this._gateResolve(); return; }
    if (![STATES.IDLE, STATES.COMPLETED, STATES.FAILED, STATES.STOPPED].includes(this.agentState.state)) {
      this.setStepMode(true);
    }
  }
  setStepMode(on) {
    this.stepMode = Boolean(on);
    this.emit('stepmode', { stepMode: this.stepMode });
  }
  stop() {
    this.stopped = true;
    this.paused = false;
    if (this.pendingApproval) {
      const p = this.pendingApproval;
      this.pendingApproval = null;
      p.resolve(false);
    }
    if (this._gateResolve) this._gateResolve();
    this.emit('notice', { kind: 'warn', text: 'Stop requested.' });
  }
  reset() {
    const busy = ![STATES.IDLE, STATES.COMPLETED, STATES.FAILED, STATES.STOPPED].includes(this.agentState.state);
    // Halt anything in flight: the loop observes `stopped` at the next gate
    // and unwinds via StopError; run() then finalizes the reset.
    this.stopped = true;
    this.paused = false;
    if (this.pendingApproval) {
      const p = this.pendingApproval;
      this.pendingApproval = null;
      try { p.resolve(false); } catch { /* noop */ }
    }
    if (this._gateResolve) { try { this._gateResolve(); } catch { /* noop */ } }
    if (busy) {
      this._resetAfterStop = true;
    } else {
      this._doReset();
    }
  }
  _doReset() {
    this.stopped = false;
    this.stepMode = false;
    this._gateResolve = null;
    this.pendingApproval = null;
    this._resumeState = null;
    this._resetAfterStop = false;
    this.agentState = createInitialAgentState();
    this.emit('state', { from: null, to: STATES.IDLE, meta: STATE_META[STATES.IDLE] });
    this.emit('reset');
  }

  // ---------- approvals ----------
  requestApproval({ toolCall, tool, reason }) {
    return new Promise((resolve) => {
      this._resumeState = this.agentState.state;
      this._applyState(STATES.WAITING_APPROVAL);
      this.pendingApproval = { toolCall, tool, reason, resolve, ts: Date.now() };
      this.emit('approval:requested', { ...this.pendingApproval });
    });
  }
  resolveApproval(approved, forRun = false) {
    const p = this.pendingApproval;
    if (!p) return;
    this.pendingApproval = null;
    if (approved && forRun) this.permissions.approveForRun(this.runId, p.tool.name);
    const back = this._resumeState && this._resumeState !== STATES.WAITING_APPROVAL ? this._resumeState : STATES.EXECUTING_TOOL;
    this._applyState(back);
    this._resumeState = null;
    this.emit('approval:resolved', { approved, forRun, tool: p.tool.name });
    p.resolve(approved);
  }

  // ---------- context ----------
  buildContext() {
    const s = this.getSettings();
    const ctx = buildContext({
      systemPrompt: s.systemPrompt,
      skillText: this.skills.injectText(),
      memory: this.memory,
      shortTerm: this.memory.shortTerm,
      tools: this.registry.toSchemas(),
      limits: this.limits
    });
    this._lastContextChars = ctx.totalChars;
    this.emit('context', { totalChars: ctx.totalChars, totalTokens: ctx.totalTokens, sections: ctx.sections.map((x) => ({ name: x.name, chars: x.chars, tokens: x.tokens })) });
    return ctx;
  }

  resolveAdapter(settings) {
    if (settings.llmMode === 'qwen') {
      const apiKey = sessionGet('qwen_key', '');
      const client = new QwenClient({ ...settings.qwen, apiKey });
      if (client.hasKey()) return { adapter: createQwenAdapter(client, settings), simulated: false, client };
      return { adapter: createSimulatedAdapter(), simulated: true, reason: 'NO_API_KEY' };
    }
    return { adapter: createSimulatedAdapter(), simulated: true, reason: 'DEMO_MODE' };
  }

  // ---------- main entry ----------
  async run(userRequest) {
    const busy = ![STATES.IDLE, STATES.COMPLETED, STATES.FAILED, STATES.STOPPED].includes(this.agentState.state);
    if (busy) { this.emit('notice', { kind: 'warn', text: 'A run is already in progress.' }); return null; }
    const text = String(userRequest || '').trim();
    if (!text) return null;

    const settings = this.getSettings();
    this.limits = { ...DEFAULT_LIMITS, ...(settings.limits || {}) };
    this.stepMode = Boolean(settings.stepMode);
    this.paused = false;
    this.stopped = false;

    const runId = uid('run');
    this.runId = runId;
    this.logger.reset(runId);
    this.permissions.beginRun(runId);
    this.memory.newRun(text);
    this.memory.shortTerm.conversation = [...this.sessionConversation, { role: 'user', content: text, ts: Date.now() }];
    this.startedAt = Date.now();
    this.agentState = { ...createInitialAgentState(), runId, startedAt: this.startedAt };

    const { adapter, simulated, reason, client } = this.resolveAdapter(settings);
    this.adapter = adapter;
    this.adapterSimulated = simulated;
    const modelLabel = simulated ? 'Simulated model (demo)' : `Qwen (${client.model})`;
    this.currentRunMeta = { runId, modelLabel, simulated, startedAt: this.startedAt, userRequest: text };

    this.logger.runStart(text, modelLabel);
    this.emit('run:start', { ...this.currentRunMeta });
    this.emit('chat', { role: 'user', content: text, ts: Date.now() });
    if (simulated) {
      this.emit('notice', {
        kind: reason === 'NO_API_KEY' ? 'warn' : 'info',
        text: reason === 'NO_API_KEY'
          ? 'Qwen is selected but no API key is stored — running in Demo mode with the simulated brain. Add a key in Settings for real reasoning.'
          : 'Demo mode: a transparent simulated brain is driving the real harness loop. Connect Qwen in Settings for real reasoning.'
      });
    }

    let status = 'completed';
    let finalAnswer = '';
    let errorMsg = '';
    try {
      await runPlanningPhase({ adapter, context: this.buildContext(), tools: this.registry.toSchemas(), runtime: this });
      const loopResult = await runAgentLoop(this);
      finalAnswer = loopResult.finalAnswer || '';
      this.memory.shortTerm.addAssistantMessage(finalAnswer);
      this.sessionConversation = [...this.memory.shortTerm.conversation];
      this.emit('chat', { role: 'assistant', content: finalAnswer, ts: Date.now(), simulated });
    } catch (e) {
      if (e instanceof StopError || this.stopped || e?.code === 'STOPPED') {
        status = 'stopped';
        finalAnswer = 'Run stopped by the user.';
        this.logger.runEnd('stopped', {});
      } else {
        status = 'failed';
        errorMsg = e?.message || String(e);
        this.logger.runError(e);
        const friendly = e?.code === 'NO_API_KEY'
          ? 'No API key configured.'
          : e?.code === 'AUTH'
            ? 'The API key was rejected (auth error). Check it in Settings.'
            : e?.code === 'RATE_LIMIT'
              ? 'The model provider rate-limited the request. Wait a moment and retry.'
              : errorMsg;
        finalAnswer = `The run failed: ${friendly}`;
        this.emit('chat', { role: 'assistant', content: finalAnswer, ts: Date.now(), error: true });
        this.emit('notice', { kind: 'error', text: `Run failed: ${friendly}` });
      }
    } finally {
      this.permissions.endRun(runId);
      this.pendingApproval = null;
      this._gateResolve = null;
    }

    const metrics = this.logger.computeMetrics({
      contextChars: this._lastContextChars,
      memoryEntries: this.memory.longTerm.count()
    });
    if (status === 'completed') {
      this.logger.runEnd('completed', metrics);
      this.setState(STATES.COMPLETED);
    } else if (status === 'stopped') {
      this._applyState(STATES.STOPPED);
    } else {
      this._applyState(STATES.FAILED);
    }

    const record = {
      id: runId,
      ts: this.startedAt,
      userRequest: text,
      objective: this.agentState.objective,
      plan: this.agentState.plan,
      result: finalAnswer,
      status,
      error: errorMsg,
      iterations: this.agentState.iteration,
      toolCalls: this.agentState.toolCallCount,
      durationMs: Date.now() - this.startedAt,
      model: modelLabel,
      simulated,
      metrics,
      trace: this.logger.toJSON()
    };
    try { this.onRunEnd && this.onRunEnd(record); } catch (e) { console.error('onRunEnd failed', e); }
    this.emit('run:end', record);
    if (this._resetAfterStop) this._doReset();
    return record;
  }
}
