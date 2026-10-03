import React from 'react';
import { useAgent, DEMO_PROMPTS } from '../state/AgentContext.jsx';
import { STAGE_DEFS, APP_TAGLINE } from '../config.js';
import { Badge, StateBadge } from '../components/StatusBadge.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { fmtDuration, fmtTime } from '../utils/format.js';

const COMPONENTS = [
  { id: 'architecture', t: 'Model Client', d: 'Talks to Qwen. Intelligence only — it proposes, never executes.', edu: 'llm' },
  { id: 'architecture', t: 'Main Loop', d: 'LLM → action → tool → observation → LLM. Without it, just a chatbot.', edu: 'loop' },
  { id: 'tools', t: 'Tool Registry', d: 'Names → real functions. The model sees schemas; the harness holds implementations.', edu: 'toolRegistry' },
  { id: 'memory', t: 'Memory Store', d: 'Short-term for the run, long-term across runs. Inspectable at any time.', edu: 'memory' },
  { id: 'skills', t: 'System Prompt + Skills', d: 'Configurable instructions plus injectable specialist guidance.', edu: 'skills' },
  { id: 'mcp', t: 'Policies & Guardrails', d: 'Permissions, approvals, limits and retries around every tool call.', edu: 'guardrails' }
];

export function Dashboard() {
  const { setView, runDemo, registry, mcpRegistry, memory, history, ui, settings, runMeta } = useAgent();
  const tools = registry.list();
  const counts = registry.countBySource();
  const modelLabel = runMeta?.modelLabel || (settings.llmMode === 'qwen' ? `Qwen (${settings.qwen.model})` : 'Simulated model (demo)');

  return (
    <div className="page">
      <div className="card" style={{ background: 'linear-gradient(135deg, #141b2b 0%, #10141f 100%)' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>AI Agent Harness Laboratory</h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 14px' }}>{APP_TAGLINE}</p>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => setView('agent')}>Open Agent Lab</button>
              <button className="btn" onClick={() => setView('architecture')}>Explore architecture</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <StateBadge meta={ui.meta} />
            <Badge tone={settings.llmMode === 'qwen' ? 'b-thinking' : 'b-sim'}>{modelLabel}</Badge>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>The six-stage loop <InfoIcon topic="loop" /></h3>
        <p className="hint">Every run visibly moves through these stages. Step mode lets you advance them one by one.</p>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, flexWrap: 'wrap' }}>
          {STAGE_DEFS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div style={{ flex: 1, minWidth: 110, background: 'var(--bg-2)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</div>
              </div>
              {i < STAGE_DEFS.length - 1 && <div style={{ alignSelf: 'center', color: 'var(--faint)' }}>→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Try a guided demo <span className="badge b-sim">no api key needed</span></h3>
        <p className="hint">Each demo runs the real harness loop end-to-end with the simulated brain and simulated tools.</p>
        <div className="demo-row">
          <button className="demo-chip" onClick={() => runDemo('calc')}>① {DEMO_PROMPTS.calc}</button>
          <button className="demo-chip" onClick={() => runDemo('email')}>② {DEMO_PROMPTS.email}</button>
          <button className="demo-chip" onClick={() => runDemo('browser')}>③ {DEMO_PROMPTS.browser}</button>
        </div>
      </div>

      <div className="card">
        <h3>Six components of a robust harness</h3>
        <p className="hint">Click any component to inspect it live.</p>
        <div className="grid grid-3">
          {COMPONENTS.map((c) => (
            <div key={c.t} className="skill-card" style={{ cursor: 'pointer' }} onClick={() => setView(c.id)}>
              <h4>{c.t} <InfoIcon topic={c.edu} /></h4>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-4">
        <div className="metric"><div className="mlabel">Tools registered</div><div className="mvalue">{tools.length}</div><div className="msub">{counts.native} native · {counts.mcp} MCP · {counts.custom} custom</div></div>
        <div className="metric"><div className="mlabel">MCP servers</div><div className="mvalue">{mcpRegistry.list().length}</div><div className="msub">configured</div></div>
        <div className="metric"><div className="mlabel">Memory facts</div><div className="mvalue">{memory.longTerm.count()}</div><div className="msub">long-term entries</div></div>
        <div className="metric"><div className="mlabel">Runs recorded</div><div className="mvalue">{history.length}</div><div className="msub">in local history</div></div>
      </div>

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Recent runs</h3>
          {history.slice(0, 5).map((r) => (
            <div className="run-row" key={r.id} onClick={() => setView('history')}>
              <span className="run-obj">{r.objective || r.userRequest}</span>
              <span className="run-meta">{r.toolCalls} tools · {fmtDuration(r.durationMs)} · {fmtTime(r.ts)}</span>
              <Badge tone={r.status === 'completed' ? 'b-success' : r.status === 'stopped' ? 'b-stopped' : 'b-error'}>{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
      <div className="foot-note">QWEN = intelligence · AGENT = goal-directed behavior · TOOLS = capabilities · MCP = external capabilities · MEMORY = persistent information · HARNESS = the system controlling everything</div>
    </div>
  );
}
