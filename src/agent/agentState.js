// Centralized agent state machine. The UI and the runtime both read from this
// single source of truth — agent state is never scattered across React state.
export const STATES = {
  IDLE: 'IDLE',
  PLANNING: 'PLANNING',
  SELECTING_ACTION: 'SELECTING_ACTION',
  EXECUTING_TOOL: 'EXECUTING_TOOL',
  OBSERVING: 'OBSERVING',
  REASONING: 'REASONING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  STOPPED: 'STOPPED'
};

const ALLOWED = {
  [STATES.IDLE]: [STATES.PLANNING],
  [STATES.PLANNING]: [STATES.SELECTING_ACTION, STATES.FAILED, STATES.STOPPED, STATES.PAUSED],
  [STATES.SELECTING_ACTION]: [STATES.EXECUTING_TOOL, STATES.WAITING_APPROVAL, STATES.REASONING, STATES.COMPLETED, STATES.FAILED, STATES.STOPPED, STATES.PAUSED],
  [STATES.EXECUTING_TOOL]: [STATES.OBSERVING, STATES.WAITING_APPROVAL, STATES.FAILED, STATES.STOPPED, STATES.PAUSED],
  [STATES.OBSERVING]: [STATES.REASONING, STATES.FAILED, STATES.STOPPED, STATES.PAUSED],
  [STATES.REASONING]: [STATES.SELECTING_ACTION, STATES.COMPLETED, STATES.FAILED, STATES.STOPPED, STATES.PAUSED],
  [STATES.WAITING_APPROVAL]: [STATES.EXECUTING_TOOL, STATES.SELECTING_ACTION, STATES.STOPPED, STATES.PAUSED, STATES.FAILED],
  [STATES.PAUSED]: [STATES.PLANNING, STATES.SELECTING_ACTION, STATES.EXECUTING_TOOL, STATES.OBSERVING, STATES.REASONING, STATES.STOPPED, STATES.FAILED, STATES.IDLE],
  [STATES.COMPLETED]: [STATES.IDLE, STATES.PLANNING],
  [STATES.FAILED]: [STATES.IDLE, STATES.PLANNING],
  [STATES.STOPPED]: [STATES.IDLE, STATES.PLANNING]
};

export function canTransition(from, to) {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export const STATE_META = {
  [STATES.IDLE]: { label: 'Idle', badge: 'b-idle', blurb: 'The harness is waiting for a task.' },
  [STATES.PLANNING]: { label: 'Planning', badge: 'b-planning', blurb: 'The LLM is turning the request into an objective and a plan.' },
  [STATES.SELECTING_ACTION]: { label: 'Selecting action', badge: 'b-thinking', blurb: 'The LLM is deciding the next action: answer, call a tool, or finish.' },
  [STATES.EXECUTING_TOOL]: { label: 'Executing tool', badge: 'b-tool', blurb: 'The harness — not the LLM — is executing the requested tool.' },
  [STATES.OBSERVING]: { label: 'Observing', badge: 'b-observing', blurb: 'The tool result is being converted into an observation for the LLM.' },
  [STATES.REASONING]: { label: 'Reasoning', badge: 'b-reasoning', blurb: 'The LLM is reasoning over the new observation: continue or finish?' },
  [STATES.WAITING_APPROVAL]: { label: 'Waiting approval', badge: 'b-approval', blurb: 'A sensitive action needs the human to approve it first.' },
  [STATES.PAUSED]: { label: 'Paused', badge: 'b-stopped', blurb: 'Execution is paused. Step forward manually or resume.' },
  [STATES.COMPLETED]: { label: 'Completed', badge: 'b-success', blurb: 'The agent finished and produced a final answer.' },
  [STATES.FAILED]: { label: 'Failed', badge: 'b-error', blurb: 'The run failed. See the trace for the cause.' },
  [STATES.STOPPED]: { label: 'Stopped', badge: 'b-stopped', blurb: 'The run was stopped by the user.' }
};

export function createInitialAgentState() {
  return {
    state: STATES.IDLE,
    previousState: null,
    runId: null,
    objective: null,
    plan: [],
    iteration: 0,
    toolCallCount: 0,
    currentTool: null,
    lastObservation: null,
    error: null,
    startedAt: null,
    updatedAt: Date.now()
  };
}
