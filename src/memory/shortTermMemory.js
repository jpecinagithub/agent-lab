// Short-term memory: everything about the CURRENT run. Ephemeral by design —
// it lives and dies with the run (a snapshot is stored in History).
export class ShortTermMemory {
  constructor() { this.reset(); }
  reset() {
    this.userRequest = '';
    this.objective = null;
    this.plan = [];
    this.conversation = []; // {role:'user'|'assistant', content, ts}
    this.observations = []; // observation objects
    this.toolCalls = []; // normalized tool call records
    this.startedAt = Date.now();
  }
  addUserMessage(text) { this.conversation.push({ role: 'user', content: String(text), ts: Date.now() }); }
  addAssistantMessage(text) { this.conversation.push({ role: 'assistant', content: String(text), ts: Date.now() }); }
  setObjective(objective) { this.objective = objective; }
  setPlan(plan) { this.plan = Array.isArray(plan) ? plan : []; }
  updatePlan(plan) { this.setPlan(plan); }
  addObservation(obs) { this.observations.push(obs); }
  addToolCall(call) { this.toolCalls.push(call); }
  snapshot() {
    return {
      userRequest: this.userRequest,
      objective: this.objective,
      plan: [...this.plan],
      conversation: [...this.conversation],
      observations: [...this.observations],
      toolCalls: [...this.toolCalls]
    };
  }
}
