import React from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { MetricsCards } from '../components/MetricsCards.jsx';
import { Badge } from '../components/StatusBadge.jsx';
import { fmtDuration, fmtTime, truncate } from '../utils/format.js';
import { formatTokens } from '../utils/tokens.js';

export function Observability() {
  const { history } = useAgent();
  const totals = history.reduce((a, r) => {
    const m = r.metrics || {};
    a.llmCalls += m.llmCalls || 0; a.toolCalls += m.toolCalls || 0; a.mcpCalls += m.mcpCalls || 0;
    a.iterations += m.iterations || 0; a.durationMs += m.durationMs || 0; a.estTokens += m.estTokens || 0;
    a.errors += m.errors || 0; a.retries += m.retries || 0;
    return a;
  }, { llmCalls: 0, toolCalls: 0, mcpCalls: 0, iterations: 0, durationMs: 0, estTokens: 0, errors: 0, retries: 0, memoryEntries: 0, contextChars: 0 });

  return (
    <div className="page-wide">
      <div className="card">
        <h3>Observability</h3>
        <p className="hint">Every run reports the same metrics. Totals below aggregate all {history.length} recorded run(s).</p>
      </div>
      <MetricsCards metrics={totals} />
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Per-run metrics</h3>
        {history.length === 0 && <div className="empty">No runs recorded yet.</div>}
        {history.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>When</th><th>Objective</th><th>Status</th><th>LLM</th><th>Tools</th><th>MCP</th><th>Iter</th><th>Time</th><th>Tokens≈</th><th>Err</th><th>Retry</th></tr></thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.ts)}</td>
                    <td style={{ maxWidth: 260 }}>{truncate(r.objective || r.userRequest, 80)}</td>
                    <td><Badge tone={r.status === 'completed' ? 'b-success' : r.status === 'stopped' ? 'b-stopped' : 'b-error'}>{r.status}</Badge></td>
                    <td className="mono">{r.metrics?.llmCalls ?? '—'}</td>
                    <td className="mono">{r.metrics?.toolCalls ?? '—'}</td>
                    <td className="mono">{r.metrics?.mcpCalls ?? '—'}</td>
                    <td className="mono">{r.metrics?.iterations ?? '—'}</td>
                    <td className="mono">{fmtDuration(r.metrics?.durationMs)}</td>
                    <td className="mono">{formatTokens(r.metrics?.estTokens)}</td>
                    <td className="mono">{r.metrics?.errors ?? '—'}</td>
                    <td className="mono">{r.metrics?.retries ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
