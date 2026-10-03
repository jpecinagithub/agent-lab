import React from 'react';
import { useAgent } from '../state/AgentContext.jsx';

const NAV = [
  { group: 'LAB' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'agent', label: 'Agent' },
  { id: 'trace', label: 'Execution Trace' },
  { id: 'architecture', label: 'Architecture' },
  { group: 'HARNESS' },
  { id: 'tools', label: 'Tools' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'memory', label: 'Memory' },
  { id: 'skills', label: 'Skills' },
  { id: 'system', label: 'System Prompt' },
  { group: 'INSIGHT' },
  { id: 'observability', label: 'Observability' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' }
];

export function Sidebar() {
  const { view, setView, ui } = useAgent();
  const running = !['IDLE', 'COMPLETED', 'FAILED', 'STOPPED'].includes(ui.state);
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>AGENT <span className="lab">LAB</span></h1>
        <p>AI AGENT HARNESS · EDUCATIONAL</p>
      </div>
      <nav className="nav">
        {NAV.map((item, i) =>
          item.group ? (
            <div className="nav-group" key={`g${i}`}>{item.group}</div>
          ) : (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              <span className={`dot ${running && item.id === 'agent' ? 'pulse-dot' : ''}`} />
              <span className="lbl">{item.label}</span>
            </button>
          )
        )}
      </nav>
      <div className="sidebar-foot">Browser-only · no backend<br />v1.0.0 educational</div>
    </aside>
  );
}
