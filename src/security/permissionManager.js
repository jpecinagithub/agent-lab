// PermissionManager: decides whether a requested tool call may run, and whether
// a human must approve it first. Guardrails; not the executor.
const ALWAYS_APPROVE = [/send/i, /delete/i, /clear_memory/i, /submit/i, /archive/i, /purchase/i, /pay/i];

export class PermissionManager {
  constructor() {
    this.runApprovals = new Map(); // runId -> Set(toolName) approved for the whole run
  }
  beginRun(runId) { this.runApprovals.set(runId, new Set()); }
  endRun(runId) { this.runApprovals.delete(runId); }
  approveForRun(runId, toolName) {
    if (!this.runApprovals.has(runId)) this.runApprovals.set(runId, new Set());
    this.runApprovals.get(runId).add(toolName);
  }
  isApprovedForRun(runId, toolName) {
    return this.runApprovals.get(runId)?.has(toolName) === true;
  }

  canExecute(tool, args = {}, runId = null) {
    if (!tool) return { allowed: false, requiresApproval: false, reason: 'Unknown tool.' };
    // Explicit flag or high risk always gates on approval.
    if (tool.requiresApproval || tool.risk === 'high') {
      if (runId && this.isApprovedForRun(runId, tool.name)) {
        return { allowed: true, requiresApproval: false, reason: 'Approved for this run.' };
      }
      return {
        allowed: true,
        requiresApproval: true,
        reason: `High-impact action: "${tool.name}" needs human approval before execution.`
      };
    }
    // Name-pattern safety net for destructive/external actions.
    if (ALWAYS_APPROVE.some((re) => re.test(tool.name))) {
      if (runId && this.isApprovedForRun(runId, tool.name)) {
        return { allowed: true, requiresApproval: false, reason: 'Approved for this run.' };
      }
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${tool.name}" looks like an external or destructive action and needs human approval.`
      };
    }
    return { allowed: true, requiresApproval: false, reason: 'Low-risk read/compute action.' };
  }
}
