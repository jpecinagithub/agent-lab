import React, { useState, useMemo } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { Badge, SourceBadge, RiskBadge } from '../components/StatusBadge.jsx';
import { JsonView } from '../components/JsonView.jsx';
import { createCustomTool, buildParametersSchema, compileHandler } from '../tools/toolFactory.js';
import { executeToolCall } from '../tools/executor.js';
import { truncate } from '../utils/format.js';

const HANDLER_TEMPLATE = `// args: the validated arguments object.
// context: { memory, signal, toolName }
// Return JSON-serializable data. Throw to report an error.
// Example: return { echo: args.text, at: new Date().toISOString() };
return { ok: true, received: args };`;

const PARAM_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

function ToolDetail({ tool, onClose }) {
  const { registry, memory, saveCustomTool, deleteCustomTool } = useAgent();
  const [testArgs, setTestArgs] = useState('{}');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    let args = {};
    try { args = testArgs.trim() ? JSON.parse(testArgs) : {}; }
    catch { setTestResult({ error: 'Test arguments are not valid JSON.' }); setTesting(false); return; }
    const { PermissionManager } = await import('../security/permissionManager.js');
    const res = await executeToolCall({
      registry,
      permissionManager: new PermissionManager(),
      toolCall: { tool: tool.name, arguments: args, reason: 'Manual test from Tool Builder' },
      context: { memory },
      timeoutMs: 15000,
      onApproval: async () => true // tests auto-approve (clearly labeled in UI)
    });
    setTestResult(res);
    setTesting(false);
  };

  return (
    <div className="drawer">
      <button className="btn btn-sm drawer-close" onClick={onClose}>✕</button>
      <h3>{tool.name} <SourceBadge source={tool.source} simulated={tool.simulated} /></h3>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>{tool.description}</p>
      <div className="kv"><span className="k">Risk</span><span className="v"><RiskBadge risk={tool.risk} /></span></div>
      <div className="kv"><span className="k">Requires approval</span><span className="v">{tool.requiresApproval ? 'yes' : 'no'}</span></div>
      <div className="kv"><span className="k">Category</span><span className="v">{tool.category}</span></div>
      <div className="kv"><span className="k">Enabled</span><span className="v">{tool.enabled ? 'yes' : 'no'}</span></div>
      <h4 style={{ fontSize: 13, margin: '14px 0 6px' }}>JSON schema (what the model sees)</h4>
      <JsonView data={{ name: tool.name, description: tool.description, parameters: tool.parameters }} />
      {tool.handlerSource && (
        <><h4 style={{ fontSize: 13, margin: '14px 0 6px' }}>Handler source (what the harness runs — the model never sees this)</h4>
        <div className="json-view"><pre>{tool.handlerSource}</pre></div></>
      )}
      <h4 style={{ fontSize: 13, margin: '14px 0 6px' }}>Test this tool</h4>
      <p className="hint" style={{ margin: '0 0 8px' }}>Approval is auto-granted for manual tests.</p>
      <textarea className="textarea" rows={3} value={testArgs} onChange={(e) => setTestArgs(e.target.value)} placeholder='{"expression": "2+2"}' />
      <div style={{ marginTop: 8 }}><button className="btn btn-sm btn-primary" disabled={testing} onClick={runTest}>{testing ? 'Running…' : 'Run test'}</button></div>
      {testResult && (
        <div style={{ marginTop: 10 }}>
          {testResult.error
            ? <div className="terminal"><span className="t-err">{testResult.error}</span></div>
            : <JsonView data={testResult} collapsed={false} />}
        </div>
      )}
      {tool.source === 'custom' && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-sm btn-danger" onClick={() => { deleteCustomTool(tool.name); onClose(); }}>Delete custom tool</button>
        </div>
      )}
    </div>
  );
}

function ToolBuilder() {
  const { saveCustomTool, registry } = useAgent();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [params, setParams] = useState([{ name: 'text', type: 'string', required: true, description: '' }]);
  const [risk, setRisk] = useState('low');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [handlerSource, setHandlerSource] = useState(HANDLER_TEMPLATE);
  const [msg, setMsg] = useState(null);

  const schema = useMemo(() => {
    try { return { ok: true, schema: buildParametersSchema(params.filter((p) => p.name.trim())) }; }
    catch (e) { return { ok: false, error: e.message }; }
  }, [params]);

  const compile = compileHandler(handlerSource);

  const addParam = () => setParams((p) => [...p, { name: '', type: 'string', required: false, description: '' }]);
  const setParam = (i, k, v) => setParams((p) => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const delParam = (i) => setParams((p) => p.filter((_, j) => j !== i));

  const save = () => {
    setMsg(null);
    try {
      const tool = createCustomTool({
        name: name.trim(), description: description.trim(),
        params: params.filter((p) => p.name.trim()),
        handlerSource, risk, requiresApproval
      });
      if (registry.has(tool.name) && registry.get(tool.name).source !== 'custom') {
        setMsg({ kind: 'error', text: `A built-in/MCP tool named "${tool.name}" already exists. Pick another name.` });
        return;
      }
      saveCustomTool(tool);
      setMsg({ kind: 'ok', text: `Tool "${tool.name}" saved and registered. The agent can use it right away.` });
      setName(''); setDescription(''); setHandlerSource(HANDLER_TEMPLATE);
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  };

  return (
    <div className="card">
      <h3>Tool Builder <InfoIcon topic="toolRegistry" /></h3>
      <p className="hint">Design a tool visually. The harness generates its JSON schema automatically and registers it — the agent can call it immediately.</p>
      <div className="grid grid-2">
        <div>
          <label className="field"><span>Tool name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="weather_lookup" /></label>
          <label className="field"><span>Description (what the model reads)</span><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Looks up the weather for a city" /></label>
          <h4 style={{ fontSize: 13, margin: '14px 0 8px' }}>Parameters</h4>
          {params.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input className="input" style={{ flex: 2 }} placeholder="name" value={p.name} onChange={(e) => setParam(i, 'name', e.target.value)} />
              <select className="select" style={{ flex: 1 }} value={p.type} onChange={(e) => setParam(i, 'type', e.target.value)}>
                {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="checkbox-row" style={{ margin: 0, whiteSpace: 'nowrap' }}><input type="checkbox" checked={p.required} onChange={(e) => setParam(i, 'required', e.target.checked)} /> req</label>
              <button className="btn btn-sm" onClick={() => delParam(i)}>✕</button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={addParam}>+ Add parameter</button>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <label className="field"><span>Risk level</span>
              <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)}>
                <option value="low">low — runs freely</option>
                <option value="medium">medium — logged carefully</option>
                <option value="high">high — needs approval</option>
              </select>
            </label>
            <label className="checkbox-row" style={{ marginTop: 26 }}><input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} /> Requires human approval</label>
          </div>
        </div>
        <div>
          <label className="field"><span>JavaScript handler <span style={{ color: 'var(--faint)' }}>(runs in the harness — the model never sees this)</span></span>
            <textarea className="textarea" rows={12} value={handlerSource} onChange={(e) => setHandlerSource(e.target.value)} />
          </label>
          {!compile.ok && <div className="warn-banner">{compile.error}</div>}
          <h4 style={{ fontSize: 13, margin: '10px 0 6px' }}>Generated JSON schema (what the model sees)</h4>
          {schema.ok ? <JsonView data={{ name: name || 'your_tool_name', description: description || '', parameters: schema.schema }} /> : <div className="warn-banner">{schema.error}</div>}
        </div>
      </div>
      {msg && <div className={msg.kind === 'ok' ? 'info-banner' : 'warn-banner'} style={{ marginTop: 12 }}>{msg.text}</div>}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={!compile.ok || !schema.ok} onClick={save}>Save tool</button>
      </div>
    </div>
  );
}

export function Tools() {
  const { registry, toolsVersion } = useAgent();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const tools = registry.list();

  const filtered = tools.filter((t) =>
    !filter || t.name.toLowerCase().includes(filter.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="page-wide">
      <div className="card">
        <h3>Tool Registry <InfoIcon topic="toolRegistry" /></h3>
        <p className="hint">Every tool the agent can call — native, MCP-discovered and custom — flows through the same executor. Click a row to inspect its schema, test it, or delete it.</p>
        <input className="input" placeholder="Filter tools…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>Description</th><th>Source</th><th>Risk</th><th>Enabled</th></tr></thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.name} onClick={() => setSelected(t)} style={{ cursor: 'pointer' }}>
                  <td className="mono"><b>{t.name}</b></td>
                  <td style={{ color: 'var(--muted)' }}>{truncate(t.description, 90)}</td>
                  <td><SourceBadge source={t.source} simulated={t.simulated} /></td>
                  <td><RiskBadge risk={t.risk} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`switch ${t.enabled ? 'on' : ''}`}
                      onClick={() => registry.setEnabled(t.name, !t.enabled)}
                      aria-label={`Toggle ${t.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="empty">No tools match.</div>}
      </div>
      <ToolBuilder />
      {selected && <ToolDetail tool={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
