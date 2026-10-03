import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { Badge } from '../components/StatusBadge.jsx';
import { JsonView } from '../components/JsonView.jsx';

function StatusBadge({ status }) {
  const tone = status === 'connected' ? 'b-success' : status === 'connecting' ? 'b-observing' : status === 'error' ? 'b-error' : 'b-idle';
  return <Badge tone={tone}>{status}</Badge>;
}

const DISCOVERY_STEPS = ['MCP SERVER CONNECTED', 'DISCOVERING TOOLS', 'TOOLS FOUND', 'TOOLS REGISTERED', 'AGENT CAN USE THEM'];

function ServerCard({ server }) {
  const { mcpRegistry, mcpConnect, mcpDiscover, mcpDisconnect, mcpRemove, registry, pushNotice } = useAgent();
  const [busy, setBusy] = useState(false);
  const [discovery, setDiscovery] = useState(null); // {step, tools}
  const status = mcpRegistry.statusOf(server.id);
  const mcpTools = registry.list().filter((t) => t.source === `mcp:${server.name}`);

  const doConnect = async () => {
    setBusy(true);
    try { await mcpConnect(server.id); pushNotice('info', `Connected to "${server.name}".`); }
    catch (e) { pushNotice('error', `Could not connect to "${server.name}": ${e.message}`); }
    setBusy(false);
  };
  const doDiscover = async () => {
    setBusy(true);
    setDiscovery({ step: 0 });
    try {
      const advance = (s) => setDiscovery((d) => ({ ...d, step: s }));
      advance(1);
      const { tools } = await mcpDiscover(server.id);
      advance(2); await new Promise((r) => setTimeout(r, 350));
      advance(3); await new Promise((r) => setTimeout(r, 350));
      setDiscovery({ step: 4, tools });
    } catch (e) {
      pushNotice('error', `Discovery failed on "${server.name}": ${e.message}`);
      setDiscovery(null);
    }
    setBusy(false);
  };
  const doDisconnect = async () => { setBusy(true); await mcpDisconnect(server.id); setDiscovery(null); setBusy(false); };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>{server.name}</h3>
        {server.demo && <span className="badge b-sim">demo</span>}
        <StatusBadge status={status} />
        <span style={{ marginLeft: 'auto' }} className="btn-row">
          {status !== 'connected'
            ? <button className="btn btn-sm btn-primary" disabled={busy} onClick={doConnect}>Connect</button>
            : <button className="btn btn-sm" disabled={busy} onClick={doDisconnect}>Disconnect</button>}
          <button className="btn btn-sm" disabled={busy || status !== 'connected'} onClick={doDiscover}>Discover tools</button>
          {!server.demo && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => mcpRemove(server.id)}>Remove</button>}
        </span>
      </div>
      <div className="kv"><span className="k">Endpoint</span><span className="v">{server.endpoint}</span></div>
      <div className="kv"><span className="k">Transport</span><span className="v">{server.transport}{server.transport === 'demo' ? ' (in-process simulation)' : ''}</span></div>
      <div className="kv"><span className="k">Auth</span><span className="v">{server.authType}</span></div>
      <div className="kv"><span className="k">Registered tools</span><span className="v">{mcpTools.length}</span></div>

      {discovery && (
        <div style={{ marginTop: 12 }}>
          {DISCOVERY_STEPS.map((s, i) => (
            <div key={s} className={`stage ${i < discovery.step ? 'done' : i === discovery.step ? 'active' : ''}`} style={{ marginBottom: 4 }}>
              <span className="snum">{i < discovery.step ? '✓' : i + 1}</span>
              <span>{s}{i === 2 && discovery.tools ? ` — ${discovery.tools.length}` : ''}</span>
            </div>
          ))}
          {discovery.tools && (
            <div style={{ marginTop: 8 }}>
              {discovery.tools.map((t) => (
                <div key={t.name} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border-soft)', fontSize: 13 }}>
                  <span className="mono" style={{ fontFamily: 'var(--mono)' }}><b>{t.name}</b></span>
                  <span style={{ color: 'var(--muted)' }}> — {t.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {mcpTools.length > 0 && !discovery && (
        <div style={{ marginTop: 8 }}>
          <JsonView data={mcpTools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))} />
        </div>
      )}
    </div>
  );
}

function AddServerForm() {
  const { mcpAdd, pushNotice } = useAgent();
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [transport, setTransport] = useState('http');
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');

  const save = () => {
    if (!name.trim() || !endpoint.trim()) { pushNotice('error', 'Name and endpoint are required.'); return; }
    mcpAdd({ name: name.trim(), endpoint: endpoint.trim(), transport, authType, authToken });
    pushNotice('info', `MCP server "${name.trim()}" added. Connect it, then discover its tools.`);
    setName(''); setEndpoint(''); setAuthToken('');
  };

  return (
    <div className="card">
      <h3>Add MCP server</h3>
      <p className="hint">Connect any MCP-compatible endpoint over HTTP/SSE (JSON-RPC). Auth tokens stay in your browser.</p>
      <div className="grid grid-2">
        <label className="field"><span>Server name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My MCP server" /></label>
        <label className="field"><span>Endpoint URL</span><input className="input" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://my-server.example/mcp" /></label>
        <label className="field"><span>Transport</span>
          <select className="select" value={transport} onChange={(e) => setTransport(e.target.value)}>
            <option value="http">HTTP (JSON-RPC POST)</option>
            <option value="sse">SSE (event stream)</option>
          </select>
        </label>
        <label className="field"><span>Authentication</span>
          <select className="select" value={authType} onChange={(e) => setAuthType(e.target.value)}>
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
          </select>
        </label>
      </div>
      {authType === 'bearer' && (
        <label className="field"><span>Bearer token</span><input className="input" type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Stored only in this browser" /></label>
      )}
      <button className="btn btn-primary" onClick={save}>Add server</button>
    </div>
  );
}

export function Mcp() {
  const { mcpRegistry, mcpVersion } = useAgent();
  const servers = mcpRegistry.list();
  return (
    <div className="page">
      <div className="card">
        <h3>MCP Servers <InfoIcon topic="mcp" /></h3>
        <p className="hint">
          The Model Context Protocol lets the agent discover tools on <b>external</b> servers. Discovered tools land in the same Tool Registry as native tools —
          the model cannot tell them apart. The two <span className="badge b-sim">demo</span> servers run in-process with clearly labeled <b>SIMULATED</b> results;
          a plain web page cannot really control Chrome tabs, so real browser control needs a compatible MCP server, extension or local bridge — never faked here.
        </p>
      </div>
      {servers.map((s) => <ServerCard key={s.id} server={s} />)}
      <AddServerForm />
    </div>
  );
}
