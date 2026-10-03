// Agent-level execution step: STEPS 3+4 (action -> execution).
// The harness takes the model's requested action and runs it through the
// generic tool pipeline. The model never touches tools directly.
import { executeToolCall } from '../tools/executor.js';
import { createObservation } from './observer.js';

export async function runExecutionStep({ toolCall, runtime }) {
  const { registry, permissions: permissionManager, logger } = runtime;

  runtime.setState('EXECUTING_TOOL');
  runtime.agentState.currentTool = toolCall.tool;
  runtime.agentState.currentAction = toolCall;
  logger.action({ type: 'tool_call', tool: toolCall.tool, arguments: toolCall.arguments, reason: toolCall.reason });
  runtime.emit('action', { ...toolCall });

  const result = await executeToolCall({
    registry,
    permissionManager,
    toolCall,
    context: { memory: runtime.memory },
    logger,
    timeoutMs: runtime.limits.toolTimeoutMs,
    runId: runtime.runId,
    onApproval: (approval) => runtime.requestApproval(approval)
  });

  // STEP 5 — OBSERVATION
  runtime.setState('OBSERVING');
  const observation = createObservation(result, toolCall);
  runtime.memory.shortTerm.addObservation(observation);
  runtime.memory.shortTerm.addToolCall({
    id: toolCall.id, tool: toolCall.tool, arguments: toolCall.arguments,
    reason: toolCall.reason, success: result.success, durationMs: result.durationMs
  });
  runtime.agentState.lastObservation = observation;
  runtime.agentState.toolCallCount += 1;
  runtime.agentState.currentTool = null;

  logger.observation(observation);
  runtime.emit('observation', observation);
  return observation;
}
