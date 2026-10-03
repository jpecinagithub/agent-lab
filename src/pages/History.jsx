import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { TraceTimeline, TraceNodeDetail } from '../components/TraceTimeline.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { Badge } from '../components/StatusBadge.jsx';
import { fmtDuration, fmtTime, truncate } from '../utils/format.js';

export function History() {
  const { history, deleteRun, clearHistory } = useAgent();
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(null);
  const open = history.find((r) => r.id === openId);

  return (
    <div className="page">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Execution history</h3>
          <span style={{ marginLeft: 'auto' }}>
            {history.length > 0 && <button className="btn btn-sm btn-danger" onClick={clearHistory}>Clear all</button>}
          </span>
        </div>
        <p className="hint">Runs are stored locally in your browser (latest 50). Click a run to reopen its complete trace.</p>
      </div>
      {history.length === 0 && <div className="card"><div className="empty">No runs yet. Go to the Agent page and start a demo.</div></div>}
      {history.map((r) => (
        <div className="card" key={r.id} style={{ padding: '14px 18px' }}>
          <div className="run-row" style={{ border: 0, padding: 0 }} onClick={() => { setOpenId(openId === r.id ? null : r.id); setSelected(null); }}>
            <span className="run-obj">{r.objective || r.userRequest}</span>
            <span className="run-meta">{r.toolCalls} tools · {r.iterations} iter · {fmtDuration(r.durationMs)} · {fmtTime(r.ts)}</span>
            <Badge tone={r.status === 'completed' ? 'b-success' : r.status === 'stopped' ? 'b-stopped' : 'b-error'}>{r.status}</Badge>
            <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); deleteRun(r.id); }}>Delete</button>
          </div>
          {openId === r.id && open && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
              <div className="kv"><span className="k">Model</span><span className="v">{r.model}{r.simulated ? ' (simulated)' : ''}</span></div>
              <div className="kv"><span className="k">User request</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{r.userRequest}</span></div>
              <h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Final answer</h4>
              <div className="msg msg-agent" style={{ maxWidth: '100%' }}><Markdown text={r.result} /></div>
              <h4 style={{ fontSize: 13, margin: '16px 0 6px' }}>Full trace</h4>
              <div className="grid grid-2" style={{ alignItems: 'start' }}>
                <TraceTimeline events={r.trace?.events || []} onSelect={setSelected} selected={selected} />
                <div className="card" style={{ margin: 0 }}><TraceNodeDetail node={selected} /></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
