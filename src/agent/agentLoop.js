// The generic agent loop — the heart of the harness (spec section 33).
// No predefined transitions: every iteration genuinely asks the model what to
// do next, executes what it asks through the tool pipeline, feeds the
// observation back, and repeats until the model finishes or a guardrail fires.
import { checkLimits } from '../security/guardrails.js';
import { runExecutionStep } from './executor.js';
import { shortId } from '../utils/id.js';
import { truncate } from '../utils/format.js';

export class StopError extends Error {
  constructor() { super('Run stopped by user.'); this.code = 'STOPPED'; }
}

function summarizeDecision(decision) {
  const a = decision?.action;
  if (!a) return '(no action)';
  if (a.type === 'final_answer') return `final answer (${(a.text || '').length} chars)`;
  if (a.type === 'tool_calls') return `tool call(s): ${(a.calls || []).map((c) => c.tool).join(', ')}`;
  return a.type;
}

export async function runAgentLoop(runtime) {
  const { logger } = runtime;
  let finished = false;
  let finalAnswer = '';

  while (!finished) {
    runtime.throwIfStopped();
    await runtime.checkpoint('iteration');

    // Guardrails before every iteration.
    const elapsed = Date.now() - runtime.startedAt;
    const probe = runtime.buildContext();
    const check = checkLimits(
      {
        iteration: runtime.agentState.iteration,
        toolCalls: runtime.agentState.toolCallCount,
        elapsedMs: elapsed,
        contextChars: probe.totalChars
      },
      runtime.limits
    );
    if (!check.ok) {
      for (const v of check.violations) logger.guardrail(v);
      const msg = check.violations.map((v) => v.message).join(' ');
      logger.decision('guardrail_stop', { violations: check.violations.map((v) => v.code) });
      finalAnswer =
        `I had to stop before finishing: ${msg} ` +
        `This is the harness protecting you from runaway loops — raise the limits in Settings if the task genuinely needs more steps.`;
      break;
    }

    // SELECTING_ACTION — ask the model for the single next action.
    runtime.setState('SELECTING_ACTION');
    const context = runtime.buildContext();
    logger.llmCall('act', runtime.adapter.label);
    let decision;
    try {
      decision = await runtime.adapter.decide({
        context,
        tools: runtime.registry.toSchemas(),
        phase: 'act',
        onToken: (t) => runtime.emit('token', { text: t })
      });
    } catch (e) {
      logger.runError(e);
      throw e;
    }
    logger.llmResponse('act', summarizeDecision(decision));

    const action = decision && decision.action;
    if (!action || !action.type) throw new Error('The model returned no usable action.');

    if (action.type === 'final_answer') {
      logger.decision('finish', { preview: truncate(action.text, 160) });
      logger.finalAnswer(action.text || '');
      finalAnswer = action.text || '';
      finished = true;
      break;
    }

    if (action.type === 'tool_calls') {
      const calls = action.calls || [];
      if (calls.length === 0) throw new Error('The model returned an empty tool-call list.');
      for (const raw of calls) {
        runtime.throwIfStopped();
        await runtime.checkpoint('tool');
        const toolCall = {
          id: raw.id || shortId('call'),
          tool: raw.tool,
          arguments: raw.arguments || {},
          reason: raw.reason || ''
        };
        await runExecutionStep({ toolCall, runtime });
        // Decision point: continue or finish comes next.
        await runtime.checkpoint('observation');
        runtime.setState('REASONING');
        logger.decision('continue', { afterTool: toolCall.tool });
      }
      runtime.agentState.iteration += 1;
      runtime.emit('iteration', { iteration: runtime.agentState.iteration });
      continue;
    }

    throw new Error(`Unknown action type "${action.type}" from the model.`);
  }

  return { finalAnswer };
}
