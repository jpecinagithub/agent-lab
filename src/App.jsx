import React from 'react';
import { useAgent } from './state/AgentContext.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ApprovalModal } from './components/ApprovalModal.jsx';
import { TutorialModal } from './components/TutorialModal.jsx';
import { StateBadge, Badge } from './components/StatusBadge.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Agent } from './pages/Agent.jsx';
import { Trace } from './pages/Trace.jsx';
import { Architecture } from './pages/Architecture.jsx';
import { Tools } from './pages/Tools.jsx';
import { Mcp } from './pages/Mcp.jsx';
import { Memory } from './pages/Memory.jsx';
import { Skills } from './pages/Skills.jsx';
import { SystemPrompt } from './pages/SystemPrompt.jsx';
import { Observability } from './pages/Observability.jsx';
import { History } from './pages/History.jsx';
import { Settings } from './pages/Settings.jsx';

const TITLES = {
  dashboard: ['Dashboard', 'Overview of your agent laboratory'],
  agent: ['Agent', 'Run the harness and watch the loop'],
  trace: ['Execution Trace', 'Every stage, clickable'],
  architecture: ['Architecture', 'The six components of a robust harness'],
  tools: ['Tools', 'Registry, inspector and builder'],
  mcp: ['MCP Servers', 'External capabilities, standardized'],
  memory: ['Memory', 'What the agent remembers'],
  skills: ['Skills', 'Injectable specialist guidance'],
  system: ['System Prompt', 'Standing instructions for the model'],
  observability: ['Observability', 'Metrics for every run'],
  history: ['History', 'Past runs with full traces'],
  settings: ['Settings', 'Model, guardrails and local data']
};

const VIEWS = {
  dashboard: Dashboard, agent: Agent, trace: Trace, architecture: Architecture,
  tools: Tools, mcp: Mcp, memory: Memory, skills: Skills, system: SystemPrompt,
  observability: Observability, history: History, settings: Settings
};

function Notices() {
  const { notices, dismissNotice } = useAgent();
  if (!notices.length) return null;
  const colors = { info: 'var(--accent)', warn: 'var(--yellow)', error: 'var(--red)' };
  return (
    <div style={{ position: 'fixed', top: 64, right: 18, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
      {notices.map((n) => (
        <div key={n.id} style={{ background: '#1a2233', border: `1px solid ${colors[n.kind] || colors.info}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>{n.text}</span>
            <button onClick={() => dismissNotice(n.id)} style={{ background: 'none', border: 0, color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { view, ui, settings, runMeta } = useAgent();
  const [title, sub] = TITLES[view] || TITLES.dashboard;
  const View = VIEWS[view] || Dashboard;
  const modelLabel = runMeta?.modelLabel || (settings.llmMode === 'qwen' ? `Qwen (${settings.qwen.model})` : 'Simulated model (demo)');

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <div>
            <h2>{title}</h2>
            <div className="sub">{sub}</div>
          </div>
          <div className="topbar-right">
            <Badge tone={settings.llmMode === 'qwen' ? 'b-thinking' : 'b-sim'}>{modelLabel}</Badge>
            <StateBadge meta={ui.meta} />
          </div>
        </header>
        <div className="content">
          <View />
        </div>
      </div>
      <Notices />
      <ApprovalModal />
      <TutorialModal />
    </div>
  );
}
