import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { EDU } from '../config.js';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { Badge, SourceBadge } from '../components/StatusBadge.jsx';

function ANode({ id, title, sub, selected, onClick }) {
  return (
    <div
      className="anode-box"
      onClick={() => onClick(id)}
      style={{
        border: `1px solid ${selected === id ? 'var(--accent)' : 'var(--border)'}`,
        background: selected === id ? 'var(--accent-dim)' : 'var(--card-2)',
        borderRadius: 10, padding: '12px 16px', cursor: 'pointer', textAlign: 'center', minWidth: 130
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

const Arrow = () => <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 18, lineHeight: 1.1, padding: '2px 0' }}>↓</div>;

export function Architecture() {
  const { setView, registry, mcpRegistry, memory, skills } = useAgent();
  const [selected, setSelected] = useState('harness');

  const DETAILS = {
    user: { title: 'User', edu: null, body: 'Everything starts with a human request. The harness receives it and turns it into an explicit agent objective — the contract the whole run is measured against.', view: 'agent', viewLabel: 'Open Agent' },
    goal: { title: 'Agent Goal', edu: 'objective', body: EDU.objective.body, view: 'agent', viewLabel: 'Open Agent' },
    qwen: { title: 'Qwen — intelligence', edu: 'llm', body: EDU.llm.body, live: `Model layer: src/llm/qwenClient.js · modelAdapter.js · streamParser.js`, view: 'settings', viewLabel: 'Configure model' },
    harness: { title: 'Harness — control', edu: 'harness', body: EDU.harness.body, live: 'Owns the state machine, the loop, permissions, limits and retries.', view: 'trace', viewLabel: 'Watch it run' },
    memory: { title: 'Memory', edu: 'memory', body: EDU.memory.body, live: `${memory.longTerm.count()} long-term fact(s) stored`, view: 'memory', viewLabel: 'Inspect memory' },
    tools: { title: 'Tools — capabilities', edu: 'toolRegistry', body: 'Tools are what the agent CAN do: calculations, memory, web fetches, browser actions, email. Each tool is a real function with a JSON schema the model can read.', live: `${registry.list().length} tool(s) registered`, view: 'tools', viewLabel: 'Open Tool Registry' },
    skills: { title: 'Skills', edu: 'skills', body: EDU.skills.body, live: `Active skill: ${skills.getActive()?.name || 'none'}`, view: 'skills', viewLabel: 'Manage skills' },
    toolRegistry: { title: 'Tool Registry', edu: 'toolRegistry', body: EDU.toolRegistry.body, live: `${registry.list().length} tool(s): ${registry.countBySource().native} native · ${registry.countBySource().mcp} MCP · ${registry.countBySource().custom} custom`, view: 'tools', viewLabel: 'Open registry' },
    native: { title: 'Native tools', edu: null, body: 'JavaScript functions running directly in the browser: calculator, clock, memory, fetch. Fast, offline-capable, and fully inspectable — open the Tools page and read their handlers.', view: 'tools', viewLabel: 'Inspect tools' },
    mcp: { title: 'MCP — external capabilities', edu: 'mcp', body: EDU.mcp.body, live: `${mcpRegistry.list().length} MCP server(s) configured`, view: 'mcp', viewLabel: 'Manage MCP servers' },
    chrome: { title: 'Chrome (via MCP)', edu: null, body: 'A real integration would drive Chrome through a compatible MCP server, extension or local browser bridge — a plain web page cannot control arbitrary tabs, and this lab never fakes it. With no real server connected, the Demo server simulates navigate/read/click so you can study the architecture. Every simulated result is labeled SIMULATED.', view: 'mcp', viewLabel: 'Open MCP servers' },
    gmail: { title: 'Gmail (via MCP)', edu: null, body: 'Same pattern: the agent discovers gmail_search, gmail_send_message and friends from an MCP server. Sending email always pauses for human approval first. The Demo server simulates an inbox so the email triage demo works with zero credentials.', view: 'mcp', viewLabel: 'Open MCP servers' }
  };
  const d = DETAILS[selected];

  return (
    <div className="page">
      <div className="card">
        <h3>Agent architecture <InfoIcon topic="harness" /></h3>
        <p className="hint">Click any component to learn what it does and inspect it live.</p>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 420, margin: '0 auto' }}>
            <ANode id="user" title="USER" selected={selected} onClick={setSelected} />
            <Arrow />
            <ANode id="goal" title="AGENT GOAL" sub="explicit objective" selected={selected} onClick={setSelected} />
            <Arrow />
            <ANode id="qwen" title="QWEN" sub="intelligence · decides" selected={selected} onClick={setSelected} />
            <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--mono)', padding: '2px 0' }}>tool call / answer</div>
            <Arrow />
            <ANode id="harness" title="HARNESS" sub="controls everything" selected={selected} onClick={setSelected} />
            <Arrow />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <ANode id="memory" title="MEMORY" sub="short + long term" selected={selected} onClick={setSelected} />
              <ANode id="tools" title="TOOLS" sub="capabilities" selected={selected} onClick={setSelected} />
              <ANode id="skills" title="SKILLS" sub="guidance" selected={selected} onClick={setSelected} />
            </div>
            <Arrow />
            <ANode id="toolRegistry" title="TOOL REGISTRY" sub="name → function" selected={selected} onClick={setSelected} />
            <Arrow />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <ANode id="native" title="Native" sub="in-browser JS" selected={selected} onClick={setSelected} />
              <ANode id="mcp" title="MCP" sub="external servers" selected={selected} onClick={setSelected} />
            </div>
            <Arrow />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <ANode id="chrome" title="Chrome" sub={<span className="sim-strip">demo</span>} selected={selected} onClick={setSelected} />
              <ANode id="gmail" title="Gmail" sub={<span className="sim-strip">demo</span>} selected={selected} onClick={setSelected} />
            </div>
          </div>
        </div>
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <h3>{d.title} {d.edu && <InfoIcon topic={d.edu} />}</h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.7 }}>{d.body}</p>
          {d.live && (
            <div className="kv"><span className="k">Live state</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{d.live}</span></div>
          )}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => setView(d.view)}>{d.viewLabel}</button>
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
            <h4 style={{ fontSize: 12, letterSpacing: 1, color: 'var(--faint)', margin: '0 0 8px' }}>THE CORE PRINCIPLE</h4>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              <b style={{ color: 'var(--text)' }}>Qwen</b> = intelligence · <b style={{ color: 'var(--text)' }}>Agent</b> = goal-directed behavior ·
              <b style={{ color: 'var(--text)' }}> Tools</b> = capabilities · <b style={{ color: 'var(--text)' }}>MCP</b> = standardized connection to external capabilities ·
              <b style={{ color: 'var(--text)' }}> Memory</b> = persistent information · <b style={{ color: 'var(--text)' }}>Harness</b> = the system controlling everything.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
