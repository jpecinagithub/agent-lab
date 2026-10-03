import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { QwenClient, DEFAULT_ENDPOINT, DEFAULT_MODEL } from '../llm/qwenClient.js';
import { sessionGet, sessionRemove, storeGet } from '../utils/storage.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config.js';

const QWEN_MODELS = [DEFAULT_MODEL];

export function Settings() {
  const { settings, updateSettings, setApiKey, pushNotice, memory, clearHistory, dismissTutorial } = useAgent();
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(() => Boolean(sessionGet('qwen_key', '')));
  const [testing, setTesting] = useState(false);
  const q = settings.qwen;
  const L = settings.limits;
  const usesManagedProxy = q.endpoint === DEFAULT_ENDPOINT;

  const saveKey = () => {
    setApiKey(keyInput);
    setHasKey(Boolean(keyInput));
    setKeyInput('');
    pushNotice('info', keyInput ? 'API key stored for this browser tab only (sessionStorage).' : 'API key cleared.');
  };
  const clearKey = () => { sessionRemove('qwen_key'); setHasKey(false); pushNotice('info', 'API key removed from this tab.'); };

  const testConnection = async () => {
    const key = sessionGet('qwen_key', '');
    setTesting(true);
    try {
      const client = new QwenClient({ endpoint: q.endpoint, apiKey: key, model: q.model, temperature: q.temperature, maxTokens: 64, timeoutMs: 25000 });
      const reply = await client.ping();
      pushNotice('info', `Connection OK — model replied: "${String(reply).slice(0, 80)}"`);
    } catch (e) {
      pushNotice('error', `Connection failed: ${e.message}`);
    }
    setTesting(false);
  };

  const setQ = (patch) => updateSettings({ qwen: patch });
  const setL = (patch) => updateSettings({ limits: patch });

  return (
    <div className="page">
      <div className="warn-banner">
        <b>Secure deployment:</b> on Vercel, the Qwen API key is read from <b>QWEN_API_KEY</b> by the serverless proxy and is never included in the browser bundle.
        The optional token below is kept in <b>sessionStorage</b> and can protect access to that proxy.
      </div>

      <div className="card">
        <h3>Reasoning model</h3>
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <button className={`btn ${settings.llmMode === 'demo' ? 'btn-primary' : ''}`} onClick={() => updateSettings({ llmMode: 'demo' })}>Demo mode <span className="badge b-sim">no key needed</span></button>
          <button className={`btn ${settings.llmMode === 'qwen' ? 'btn-primary' : ''}`} onClick={() => updateSettings({ llmMode: 'qwen' })}>Qwen (real model)</button>
        </div>
        {settings.llmMode === 'demo' && (
          <p className="hint">A transparent, rule-based simulated brain drives the <b>real</b> harness loop — planning, tool calls, observations, guardrails and approvals all execute for real. Every simulated model decision and tool result is labeled <span className="sim-strip">SIMULATED</span>.</p>
        )}
        {settings.llmMode === 'qwen' && (
          <>
            <div className="grid grid-2">
              <label className="field"><span>API endpoint (OpenAI-compatible)</span>
                <input className="input" value={q.endpoint} onChange={(e) => setQ({ endpoint: e.target.value })} placeholder={DEFAULT_ENDPOINT} />
              </label>
              <label className="field"><span>Model</span>
                <select className="select" value={QWEN_MODELS.includes(q.model) ? q.model : '__custom'} onChange={(e) => setQ({ model: e.target.value === '__custom' ? q.model : e.target.value })}>
                  {QWEN_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="__custom">Custom…</option>
                </select>
              </label>
            </div>
            {!QWEN_MODELS.includes(q.model) && (
              <label className="field"><span>Custom model name</span><input className="input" value={q.model} onChange={(e) => setQ({ model: e.target.value })} /></label>
            )}
            <div className="grid grid-2">
              <label className="field"><span>Temperature: {q.temperature}</span>
                <input type="range" min="0" max="2" step="0.1" value={q.temperature} onChange={(e) => setQ({ temperature: parseFloat(e.target.value) })} style={{ width: '100%' }} />
              </label>
              <label className="field"><span>Max tokens</span>
                <input className="input" type="number" min="64" max="32000" value={q.maxTokens} onChange={(e) => setQ({ maxTokens: parseInt(e.target.value, 10) || 2000 })} />
              </label>
            </div>
            <label className="field"><span>Proxy access token / local API key {hasKey ? <span className="badge b-success">stored in this tab</span> : usesManagedProxy ? <span className="badge b-success">server environment</span> : <span className="badge">not stored</span>}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Optional access token; required if AGENT_LAB_ACCESS_TOKEN is set" autoComplete="off" />
                <button className="btn btn-primary" onClick={saveKey}>Store</button>
                {hasKey && <button className="btn" onClick={clearKey}>Clear</button>}
              </div>
            </label>
            <div className="btn-row">
              <button className="btn" disabled={testing || (!hasKey && !usesManagedProxy)} onClick={testConnection}>{testing ? 'Testing…' : 'Test connection'}</button>
              <button className="btn" onClick={() => setQ({ endpoint: DEFAULT_ENDPOINT })}>Reset endpoint</button>
            </div>
          </>
        )}
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
