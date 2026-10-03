import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { fmtTime, truncate } from '../utils/format.js';

export function Memory() {
  const { memory, memVersion } = useAgent();
  const [query, setQuery] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const short = memory.shortTerm;
  const entries = query.trim() ? memory.search(query, 50) : memory.list();

  const save = () => {
    if (!key.trim() || !value.trim()) return;
    memory.remember(key.trim(), value.trim(), note.trim(), 'user');
    setKey(''); setValue(''); setNote('');
  };

  return (
    <div className="page">
      <div className="card">
        <h3>Memory inspector <InfoIcon topic="memory" /></h3>
        <p className="hint">See exactly what the agent remembers. Short-term memory lives only for the current run; long-term memory persists in your browser and is injected into the model's context.</p>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>Short-term memory <span className="badge">this run</span></h3>
          <div className="kv"><span className="k">Objective</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{short.objective || '—'}</span></div>
          <div className="kv"><span className="k">Plan steps</span><span className="v">{short.plan.length}</span></div>
          <div className="kv"><span className="k">Observations</span><span className="v">{short.observations.length}</span></div>
          <div className="kv"><span className="k">Tool calls</span><span className="v">{short.toolCalls.length}</span></div>
          <h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Conversation turns ({short.conversation.length})</h4>
          {short.conversation.length === 0 && <div className="empty">No turns yet.</div>}
          {short.conversation.slice(-6).map((m, i) => (
            <div key={i} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: '1px dashed var(--border-soft)' }}>
              <b style={{ color: m.role === 'user' ? 'var(--accent)' : 'var(--green)' }}>{m.role}</b>
              <span style={{ color: 'var(--muted)' }}> — {truncate(m.content, 160)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Long-term memory <span className="badge b-success">{memory.longTerm.count()} facts</span></h3>
          <input className="input" placeholder="Search memory…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 10 }} />
          {entries.length === 0 && <div className="empty">{query ? 'No matches.' : 'Nothing remembered yet. Run the calculator demo — it saves its result here.'}</div>}
          {entries.map((e) => (
            <div key={e.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <b style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{e.key}</b>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)' }}>{fmtTime(e.updatedAt)}</span>
                <button className="btn btn-sm btn-danger" onClick={() => memory.remove(e.key)}>Delete</button>
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{e.value}</div>
              {e.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.note}</div>}
            </div>
          ))}
          <h4 style={{ fontSize: 13, margin: '14px 0 8px' }}>Remember something manually</h4>
          <div className="grid grid-2">
            <label className="field"><span>Key</span><input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="favorite_color" /></label>
            <label className="field"><span>Note (optional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="why this matters" /></label>
          </div>
          <label className="field"><span>Value</span><input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="What should the agent remember?" /></label>
          <button className="btn btn-primary" onClick={save}>Save to memory</button>
        </div>
      </div>
    </div>
  );
}
