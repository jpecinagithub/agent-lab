import React from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { JsonView } from './JsonView.jsx';
import { RiskBadge } from './StatusBadge.jsx';
import { InfoIcon } from './InfoIcon.jsx';

// Human-in-the-loop gate: dangerous actions pause the loop until approved.
export function ApprovalModal() {
  const { pendingApproval, runtime } = useAgent();
  if (!pendingApproval) return null;
  const { tool, toolCall, reason } = pendingApproval;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Approval required <InfoIcon topic="approval" inline /></h2>
        <p className="lede">The agent wants to perform a sensitive action. Nothing has been executed yet.</p>
        <div className="kv"><span className="k">Tool</span><span className="v">{tool.name}</span></div>
        <div className="kv"><span className="k">Risk</span><span className="v"><RiskBadge risk={tool.risk} /></span></div>
        <div className="kv"><span className="k">Reason</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{reason}</span></div>
        {toolCall.reason && (
          <div className="kv"><span className="k">Agent's explanation</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{toolCall.reason}</span></div>
        )}
        <h4 style={{ margin: '14px 0 6px', fontSize: 13 }}>Arguments</h4>
        <JsonView data={toolCall.arguments} collapsed={false} />
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={() => runtime.resolveApproval(false)}>Deny</button>
          <button className="btn" onClick={() => runtime.resolveApproval(true, true)}>Approve for this run</button>
          <button className="btn btn-primary" onClick={() => runtime.resolveApproval(true, false)}>Approve once</button>
        </div>
      </div>
    </div>
  );
}
