import React from 'react';

export function Badge({ tone = 'b-idle', children, title }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      <span className="bdot" />
      {children}
    </span>
  );
}

// Agent-state badge driven by the centralized state machine metadata.
export function StateBadge({ meta }) {
  if (!meta) return null;
  return <Badge tone={meta.badge} title={meta.blurb}>{meta.label}</Badge>;
}

export function SourceBadge({ source, simulated }) {
  if (simulated) return <Badge tone="b-sim">Simulated</Badge>;
  if (!source) return null;
  if (source === 'native') return <Badge tone="b-native">Native</Badge>;
  if (source === 'custom') return <Badge tone="b-custom">Custom</Badge>;
  if (String(source).startsWith('mcp:')) return <Badge tone="b-mcp">MCP</Badge>;
  return <Badge>{source}</Badge>;
}

export function RiskBadge({ risk }) {
  const tone = risk === 'high' ? 'b-error' : risk === 'medium' ? 'b-approval' : 'b-success';
  return <Badge tone={tone}>{risk || 'low'} risk</Badge>;
}
