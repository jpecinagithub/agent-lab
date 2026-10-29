import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { SparkClient, DEFAULT_GATEWAY_URL, DEFAULT_SPARK_MODEL } from '../llm/sparkClient.js';
import { storeGet } from '../utils/storage.js';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_GMAIL_CLIENT_ID } from '../config.js';

export function Settings() {
  const { settings, updateSettings, pushNotice, memory, clearHistory, dismissTutorial, gmailConnected, connectGmail, disconnectGmail } = useAgent();
  const [testing, setTesting] = useState(false);
  const [gmailBusy, setGmailBusy] = useState(false);
  const s = settings.spark || {};
  const g = settings.gmail || {};
  const L = settings.limits;

  const testConnection = async () => {
    setTesting(true);
    try {
      const client = new SparkClient({ gatewayUrl: s.gatewayUrl, model: s.model, timeoutMs: 120000 });
      const reply = await client.ping();
      pushNotice('info', `Connection OK — model replied: "${String(reply).slice(0, 80)}"`);
    } catch (e) {
      pushNotice('error', `Connection failed: ${e.message}`);
    }
    setTesting(false);
  };

  const setS = (patch) => updateSettings({ spark: patch });
  const setL = (patch) => updateSettings({ limits: patch });

  return (
    <div className="page">
      <div className="warn-banner">
        <b>Your own model backend:</b> the browser talks directly to your OpenCode gateway at the URL below
        (the same backend spark-chat uses). No API key ever leaves your server — the gateway runs the official
        <b> opencode CLI</b> there with the key in <b>/opt/spark-chat/.env</b>.
      </div>

      <div className="card">
        <h3>Reasoning model</h3>
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <button className={`btn ${settings.llmMode === 'demo' ? 'btn-primary' : ''}`} onClick={() => updateSettings({ llmMode: 'demo' })}>Demo mode <span className="badge b-sim">no key needed</span></button>
          <button className={`btn ${settings.llmMode === 'spark' ? 'btn-primary' : ''}`} onClick={() => updateSettings({ llmMode: 'spark' })}>{(s.model || DEFAULT_SPARK_MODEL)} <span className="badge b-success">real model · OpenCode</span></button>
        </div>
        {settings.llmMode === 'demo' && (
          <p className="hint">A transparent, rule-based simulated brain drives the <b>real</b> harness loop — planning, tool calls, observations, guardrails and approvals all execute for real. Every simulated model decision and tool result is labeled <span className="sim-strip">SIMULATED</span>.</p>
        )}
        {settings.llmMode === 'spark' && (
          <>
            <p className="hint">
              The harness sends each decision to <b>{s.model || DEFAULT_SPARK_MODEL}</b> (served free via OpenCode Zen)
              through your gateway. The gateway is text-only, so the client teaches the model a strict JSON
              tool-call protocol — the harness still owns the Tool Registry, guardrails and the trace.
            </p>
            <div className="grid grid-2">
              <label className="field"><span>OpenCode gateway URL</span>
                <input className="input" value={s.gatewayUrl || ''} onChange={(e) => setS({ gatewayUrl: e.target.value })} placeholder={DEFAULT_GATEWAY_URL} autoComplete="off" spellCheck="false" />
              </label>
              <label className="field"><span>Model</span>
                <input className="input" value={s.model || DEFAULT_SPARK_MODEL} onChange={(e) => setS({ model: e.target.value })} autoComplete="off" spellCheck="false" />
              </label>
            </div>
            <div className="btn-row">
              <button className="btn" disabled={testing} onClick={testConnection}>{testing ? 'Testing… (can take a minute)' : 'Test connection'}</button>
              <button className="btn" onClick={() => setS({ gatewayUrl: DEFAULT_GATEWAY_URL, model: DEFAULT_SPARK_MODEL })}>Reset gateway</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>Gmail — native tools <InfoIcon topic="tools" /></h3>
        <p className="hint">
          Connect your Google account to replace the <span className="badge b-sim">SIMULATED</span> demo
          versions of <b>gmail_search</b> and <b>gmail_get_message</b> with <span className="badge b-native">NATIVE</span> tools
          that call the real Gmail API (read-only scope). No MCP involved — the browser talks to Google directly.
          The OAuth token lives in <b>sessionStorage</b> (this tab only).
        </p>
        <label className="field"><span>Google OAuth Client ID (public — it only identifies the app)</span>
          <input className="input" value={g.clientId || ''} onChange={(e) => updateSettings({ gmail: { clientId: e.target.value } })} placeholder={DEFAULT_GMAIL_CLIENT_ID} autoComplete="off" spellCheck="false" />
        </label>
        <div className="btn-row">
          {!gmailConnected ? (
            <button className="btn btn-primary" disabled={gmailBusy} onClick={async () => {
              setGmailBusy(true);
              try { await connectGmail(); }
              catch (e) { pushNotice('error', `Gmail connection failed: ${e.message}`); }
              setGmailBusy(false);
            }}>{gmailBusy ? 'Connecting…' : 'Connect Gmail'}</button>
          ) : (
            <button className="btn btn-danger" onClick={disconnectGmail}>Disconnect Gmail</button>
          )}
          <button className="btn" onClick={() => updateSettings({ gmail: { clientId: DEFAULT_GMAIL_CLIENT_ID } })}>Reset Client ID</button>
          <span className={`badge ${gmailConnected ? 'b-success' : ''}`}>{gmailConnected ? 'connected — real Gmail tools active' : 'not connected — simulated tools active'}</span>
        </div>
      </div>

      <div className="card">
        <h3>Loop guardrails <InfoIcon topic="guardrails" /></h3>
        <p className="hint">Hard limits checked before every iteration. Defaults protect against infinite loops.</p>
        <div className="grid grid-3">
          <label className="field"><span>maxIterations (default 10)</span>
            <input className="input" type="number" min="1" max="100" value={L.maxIterations} onChange={(e) => setL({ maxIterations: parseInt(e.target.value, 10) || 10 })} />
          </label>
          <label className="field"><span>maxToolCalls</span>
            <input className="input" type="number" min="1" max="500" value={L.maxToolCalls} onChange={(e) => setL({ maxToolCalls: parseInt(e.target.value, 10) || 25 })} />
          </label>
          <label className="field"><span>Run timeout (ms)</span>
            <input className="input" type="number" min="5000" step="1000" value={L.timeoutMs} onChange={(e) => setL({ timeoutMs: parseInt(e.target.value, 10) || 180000 })} />
          </label>
          <label className="field"><span>Per-tool timeout (ms)</span>
            <input className="input" type="number" min="1000" step="1000" value={L.toolTimeoutMs} onChange={(e) => setL({ toolTimeoutMs: parseInt(e.target.value, 10) || 30000 })} />
          </label>
          <label className="field"><span>Max context size (chars)</span>
            <input className="input" type="number" min="2000" step="1000" value={L.maxContextSize} onChange={(e) => setL({ maxContextSize: parseInt(e.target.value, 10) || 60000 })} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>System prompt</h3>
        <p className="hint">{settings.systemPrompt === DEFAULT_SYSTEM_PROMPT ? 'Using the default system prompt.' : 'Custom system prompt active.'}</p>
        <button className="btn" onClick={() => updateSettings({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}>Restore default system prompt</button>
      </div>

      <div className="card">
        <h3>Local data</h3>
        <p className="hint">Everything lives in your browser. No account, no backend.</p>
        <div className="btn-row">
          <button className="btn btn-danger" onClick={() => { if (window.confirm('Delete all recorded runs?')) clearHistory(); }}>Clear run history</button>
          <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete all ${memory.longTerm.count()} long-term memory entries?`)) memory.clear(); }}>Clear long-term memory</button>
          <button className="btn" onClick={() => { dismissTutorial(); window.location.reload(); }}>Replay first-run tutorial</button>
        </div>
      </div>
    </div>
  );
}
