import React, { useState, useRef, useEffect } from 'react';
import { useAgent, DEMO_PROMPTS } from '../state/AgentContext.jsx';
import { STAGE_DEFS, stageForState } from '../config.js';
import { StateBadge, Badge, SourceBadge } from '../components/StatusBadge.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { JsonView } from '../components/JsonView.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { ControlPanel } from '../components/ControlPanel.jsx';
import { LiveDiagram } from '../components/LiveDiagram.jsx';
import { formatTokens } from '../utils/tokens.js';

function ChatBubble({ msg }) {
  if (msg.role === 'user') {
    return <div className="msg msg-user"><div className="meta">You</div><Markdown text={msg.content} /></div>;
  }
  if (msg.role === 'system') {
    return <div className="msg msg-system">{msg.content}</div>;
  }
  return (
    <div className="msg msg-agent">
      <div className="meta">Agent {msg.simulated ? <span className="sim-strip">demo brain</span> : null} {msg.error ? <Badge tone="b-error">error</Badge> : null}</div>
      <Markdown text={msg.content} />
    </div>
  );
}

export function Agent() {
  const {
    ui, chat, streaming, sendMessage, clearChat, runDemo, runtime,
    settings, runMeta, contextInfo, registry
  } = useAgent();
  const [input, setInput] = useState('');
  const logRef = useRef(null);
  const running = !['IDLE', 'COMPLETED', 'FAILED', 'STOPPED'].includes(ui.state);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, streaming]);

  const submit = () => {
    const t = input.trim();
    if (!t || running) return;
    setInput('');
    sendMessage(t);
  };

  const activeStage = stageForState(ui.state);
  const order = STAGE_DEFS.map((s) => s.key);
  const activeIdx = order.indexOf(activeStage);
  const allDone = ui.state === 'COMPLETED';
  const modelLabel = runMeta?.modelLabel || (settings.llmMode === 'qwen' ? `Qwen (${settings.qwen.model})` : 'Simulated model (demo)');
  const actionTool = ui.currentAction ? registry.get(ui.currentAction.tool) : null;

  return (
    <div className="page-wide">
      <div className="agent-layout">
        {/* left: conversation */}
        <div className="chat-panel">
          <div className="card">
            <h3>Agent conversation {runMeta?.simulated !== false && <span className="badge b-sim">demo mode</span>}</h3>
            <p className="hint">Type a request — or run a guided demo. Watch the <b>Live Harness</b> panel on the right as the loop runs.</p>
            <div className="demo-row">
              <button className="demo-chip" disabled={running} onClick={() => runDemo('calc')}>demo: {DEMO_PROMPTS.calc}</button>
              <button className="demo-chip" disabled={running} onClick={() => runDemo('email')}>demo: {DEMO_PROMPTS.email}</button>
              <button className="demo-chip" disabled={running} onClick={() => runDemo('browser')}>demo: {DEMO_PROMPTS.browser}</button>
            </div>
            <div className="chat-log" ref={logRef}>
              {chat.length === 0 && (
                <div className="empty">No messages yet. Ask the agent something, or start a demo above.<br /><br />Try: <i>“Calculate 18% of 2,450 and remember the result.”</i></div>
              )}
              {chat.map((m, i) => <ChatBubble key={i} msg={m} />)}
              {streaming && (
                <div className="msg msg-agent"><div className="meta">Agent · streaming</div><Markdown text={streaming} /><span style={{ color: 'var(--accent)' }}>▍</span></div>
              )}
            </div>
            <div className="chat-input-row">
              <input
                className="input"
                placeholder={running ? 'Agent is working…' : 'Ask the agent… (e.g. Calculate 18% of 2,450 and remember the result)'}
                value={input}
                disabled={running}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              />
              <button className="btn btn-primary" disabled={running || !input.trim()} onClick={submit}>Send</button>
              <button className="btn" onClick={clearChat} title="Clear conversation">Clear</button>
            </div>
          </div>
          <div className="card">
            <h3>Agent controls</h3>
            <ControlPanel />
          </div>
        </div>

        {/* right: live harness */}
        <div className="harness-panel">
          <div className="card">
            <div className="harness-head">
              <h3>LIVE HARNESS</h3>
              <StateBadge meta={ui.meta} />
            </div>
            <div className="kv"><span className="k">Model</span><span className="v">{modelLabel}</span></div>
            <div className="kv"><span className="k">Iteration</span><span className="v">{ui.agentState?.iteration ?? 0} / {settings.limits.maxIterations}</span></div>
            <div className="kv"><span className="k">Tool calls</span><span className="v">{ui.agentState?.toolCallCount ?? 0} / {settings.limits.maxToolCalls}</span></div>
            <div className="kv"><span className="k">Context</span><span className="v">≈ {formatTokens(contextInfo?.totalTokens)} tokens</span></div>

            <h4 style={{ fontSize: 12, margin: '14px 0 6px', letterSpacing: 1, color: 'var(--faint)' }}>EXECUTION STAGES</h4>
            <div className="stage-list">
              {STAGE_DEFS.map((s) => {
                const idx = order.indexOf(s.key);
                const cls = allDone || idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : '';
                return (
                  <div className={`stage ${cls}`} key={s.key}>
                    <span className="snum">{idx < activeIdx || allDone ? '✓' : s.n}</span>
                    <span>{s.label}</span>
                    {s.key === 'objective' && <InfoIcon topic="objective" />}
                    {s.key === 'plan' && <InfoIcon topic="plan" />}
                    {s.key === 'observation' && <InfoIcon topic="observation" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3>Objective <InfoIcon topic="objective" /></h3>
            <p style={{ margin: 0, fontSize: 13 }}>{ui.objective || <span style={{ color: 'var(--faint)' }}>Waiting for a task…</span>}</p>
            {ui.plan?.length > 0 && (
              <>
                <h3 style={{ marginTop: 14 }}>Plan <InfoIcon topic="plan" /></h3>
                <ol className="plan-list">
                  {ui.plan.map((s, i) => <li key={i}><span className="pnum">{i + 1}.</span><span>{s}</span></li>)}
                </ol>
              </>
            )}
          </div>

          {(ui.currentAction || ui.lastObservation) && (
            <div className="card">
              <h3>Current step</h3>
              {ui.currentAction && (
                <>
                  <div className="kv"><span className="k">Tool</span><span className="v">{ui.currentAction.tool} {actionTool && <SourceBadge source={actionTool.source} simulated={actionTool.simulated} />}</span></div>
                  {ui.currentAction.reason && <p style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic' }}>“{ui.currentAction.reason}”</p>}
                  <JsonView data={ui.currentAction.arguments} />
                </>
              )}
              {ui.lastObservation && !ui.currentAction && (
                <>
                  <div className="kv"><span className="k">Last observation</span><span className="v">{ui.lastObservation.tool} {ui.lastObservation.simulated && <span className="sim-strip">SIMULATED</span>}</span></div>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{ui.lastObservation.summary}</p>
                </>
              )}
            </div>
          )}

          <div className="card">
            <h3>Live execution graph</h3>
            <LiveDiagram />
          </div>
        </div>
      </div>
    </div>
  );
}
