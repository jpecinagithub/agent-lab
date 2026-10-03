import React from 'react';
import { fmtDuration } from '../utils/format.js';
import { formatTokens as ft } from '../utils/tokens.js';

export function MetricsCards({ metrics }) {
  if (!metrics) return <div className="empty">No metrics yet — run the agent to populate the observability dashboard.</div>;
  const items = [
    { label: 'LLM calls', value: metrics.llmCalls, sub: 'model decisions' },
    { label: 'Tool calls', value: metrics.toolCalls, sub: 'executed by harness' },
    { label: 'MCP calls', value: metrics.mcpCalls, sub: 'via MCP servers' },
    { label: 'Iterations', value: metrics.iterations, sub: 'loop cycles' },
    { label: 'Exec time', value: fmtDuration(metrics.durationMs), sub: 'wall clock' },
    { label: 'Est. tokens', value: ft(metrics.estTokens), sub: '≈ chars / 4' },
    { label: 'Errors', value: metrics.errors, sub: 'caught, not crashed' },
    { label: 'Retries', value: metrics.retries, sub: 'max 2 per tool' },
    { label: 'Memory entries', value: metrics.memoryEntries, sub: 'long-term facts' },
    { label: 'Context chars', value: metrics.contextChars?.toLocaleString?.() || metrics.contextChars, sub: 'last built context' }
  ];
  return (
    <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {items.map((m) => (
        <div className="metric" key={m.label}>
          <div className="mlabel">{m.label}</div>
          <div className="mvalue">{m.value}</div>
          <div className="msub">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}
