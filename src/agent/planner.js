// Planner: STEP 1 (Objective) + STEP 2 (Plan). Asks the model to turn the raw
// user request into an explicit objective and a living plan.
export async function runPlanningPhase({ adapter, context, tools, runtime }) {
  runtime.setState('PLANNING');
  await runtime.checkpoint('objective');
  runtime.logger.llmCall('plan', adapter.label);
  runtime.emit('notice', { kind: 'llm', text: `Asking ${adapter.label} to form an objective and plan…` });

  let decision;
  try {
    decision = await adapter.decide({ context, tools, phase: 'plan' });
  } catch (e) {
    runtime.logger.runError(e);
    throw e;
  }
  runtime.logger.llmResponse('plan', decision?.objective || '');

  if (!decision || decision.kind !== 'plan') {
    throw new Error('Planner returned an unexpected response. The run cannot continue safely.');
  }
  const objective = String(decision.objective || context.userRequest || '').slice(0, 500) || 'Complete the user request.';
  const plan = Array.isArray(decision.plan) ? decision.plan.filter(Boolean).slice(0, 8) : [];

  runtime.memory.shortTerm.setObjective(objective);
  runtime.memory.shortTerm.setPlan(plan);
  runtime.agentState.objective = objective;
  runtime.agentState.plan = plan;

  runtime.logger.objective(objective);
  runtime.logger.plan(plan, decision.note || '');
  runtime.emit('objective', { objective, plan, note: decision.note || '' });
  if (decision.degraded) {
    runtime.emit('notice', { kind: 'warn', text: 'The model did not return structured planning JSON — using a generic fallback plan.' });
  }
  await runtime.checkpoint('action');
  return { objective, plan };
}
