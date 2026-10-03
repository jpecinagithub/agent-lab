import React from 'react';
import { useAgent } from '../state/AgentContext.jsx';

// Animated live view of User → Qwen → Harness → Decision → Tool → Observation.
const NODES = [
  { id: 'user', x: 130, y: 6, w: 80, h: 30, label: 'USER' },
  { id: 'qwen', x: 130, y: 58, w: 80, h: 34, label: 'QWEN', sub: 'brain' },
  { id: 'harness', x: 130, y: 114, w: 80, h: 34, label: 'HARNESS', sub: 'control' },
  { id: 'decision', x: 130, y: 170, w: 80, h: 30, label: 'Decision' },
  { id: 'memory', x: 14, y: 226, w: 92, h: 32, label: 'Memory' },
  { id: 'tool', x: 124, y: 226, w: 92, h: 32, label: 'Tool' },
  { id: 'answer', x: 234, y: 226, w: 92, h: 32, label: 'Answer' },
  { id: 'registry', x: 124, y: 284, w: 92, h: 32, label: 'Registry', sub: 'tools' },
  { id: 'native', x: 14, y: 342, w: 92, h: 32, label: 'Native' },
  { id: 'mcp', x: 124, y: 342, w: 92, h: 32, label: 'MCP' },
  { id: 'chrome', x: 14, y: 398, w: 92, h: 30, label: 'Chrome', sub: 'demo' },
  { id: 'gmail', x: 124, y: 398, w: 92, h: 30, label: 'Gmail', sub: 'demo' }
];
const EDGES = [
  ['user', 'qwen'], ['qwen', 'harness'], ['harness', 'decision'],
  ['decision', 'memory'], ['decision', 'tool'], ['decision', 'answer'],
  ['tool', 'registry'], ['registry', 'native'], ['registry', 'mcp'],
  ['mcp', 'chrome'], ['mcp', 'gmail']
];

function center(n, side) {
  if (side === 'top') return [n.x + n.w / 2, n.y];
  if (side === 'bottom') return [n.x + n.w / 2, n.y + n.h];
  if (side === 'left') return [n.x, n.y + n.h / 2];
  return [n.x + n.w, n.y + n.h / 2];
}

export function LiveDiagram() {
  const { ui, registry } = useAgent();
  const active = new Set();
  const memTools = ['save_memory', 'search_memory', 'clear_memory'];
  switch (ui.state) {
    case 'IDLE': active.add('user'); break;
    case 'PLANNING': active.add('qwen'); break;
    case 'SELECTING_ACTION': active.add('decision'); break;
    case 'EXECUTING_TOOL':
    case 'WAITING_APPROVAL': {
      active.add('tool'); active.add('registry'); active.add('harness');
      const t = registry.get(ui.currentTool);
      const src = t?.source || '';
      if (src.startsWith('mcp:')) {
        active.add('mcp');
        if (/gmail/i.test(src)) active.add('gmail');
        if (/chrome|browser/i.test(src)) active.add('chrome');
      } else active.add('native');
      if (memTools.includes(ui.currentTool)) active.add('memory');
      break;
    }
    case 'OBSERVING': active.add('harness'); active.add('tool'); break;
    case 'REASONING': active.add('qwen'); active.add('harness'); break;
    case 'PAUSED': active.add('harness'); break;
    case 'COMPLETED': active.add('answer'); break;
    case 'FAILED':
    case 'STOPPED': active.add('harness'); break;
    default: active.add('harness');
  }

  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <svg className="live-diagram" viewBox="0 0 340 436" role="img" aria-label="Live agent execution diagram">
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#3a4763" />
        </marker>
      </defs>
      {EDGES.map(([a, b]) => {
        const A = byId[a]; const B = byId[b];
        const [x1, y1] = center(A, 'bottom');
        const [x2, y2] = center(B, 'top');
        const on = active.has(a) && active.has(b);
        // elbow for branch edges
        const d = a === 'decision'
          ? `M ${x1} ${y1} C ${x1} ${y1 + 14}, ${x2} ${y2 - 14}, ${x2} ${y2}`
          : `M ${x1} ${y1} L ${x2} ${y2}`;
        return <path key={`${a}-${b}`} d={d} className={`dedge ${on ? 'active' : ''}`} markerEnd="url(#arr)" />;
      })}
      {NODES.map((n) => (
        <g key={n.id} className={`dnode ${active.has(n.id) ? 'active' : ''}`}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8" />
          <text x={n.x + n.w / 2} y={n.y + (n.sub ? n.h / 2 - 1 : n.h / 2 + 4)} textAnchor="middle">{n.label}</text>
          {n.sub && <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 11} textAnchor="middle" style={{ fontSize: 8, fontWeight: 400 }}>{n.sub}</text>}
        </g>
      ))}
    </svg>
  );
}
