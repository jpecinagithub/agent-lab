import React from 'react';
import { fmtClock, fmtDuration, truncate } from '../utils/format.js';
import { JsonView } from './JsonView.jsx';
import { Badge } from './StatusBadge.jsx';

// Groups raw logger events into visual trace nodes.
export function buildTraceNodes(events) {
  const nodes = [];
  const byCallId = new Map();
  for (const ev of events) {
    switch (ev.type) {
      case 'run_start':
        nodes.push({ kind: 'run', title: 'RUN STARTED', sub: truncate(ev.userRequest, 120), ts: ev.ts, tone: '', ev });
        break;
      case 'objective':
        nodes.push({ kind: 'objective', title: 'OBJECTIVE', sub: truncate(ev.objective, 140), ts: ev.ts, tone: 'b-thinking', ev });
        break;
      case 'plan':
        nodes.push({ kind: 'plan', title: 'PLAN', sub: `${(ev.plan || []).length} step(s) drafted`, ts: ev.ts, tone: 'b-planning', ev });
        break;
      case 'llm_call': {
        const n = { kind: 'think', title: ev.phase === 'plan' ? 'QWEN · PLANNING' : 'QWEN · DECIDING', sub: `model: ${ev.model || '—'}`, ts: ev.ts, tone: 'b-thinking', ev, response: null };
        nodes.push(n);
        break;
      }
      case 'llm_response': {
        const last = [...nodes].reverse().find((n) => n.kind === 'think' && !n.response);
        if (last) { last.response = ev.summary; last.sub = truncate(ev.summary || '', 120); }
        else nodes.push({ kind: 'think', title: 'QWEN · RESPONSE', sub: truncate(ev.summary || '', 120), ts: ev.ts, tone: 'b-thinking', ev });
        break;
      }
      case 'action':
        nodes.push({ kind: 'action', title: 'ACTION SELECTED', sub: `${ev.action?.tool} — ${truncate(ev.action?.reason || '', 100)}`, ts: ev.ts, tone: 'b-tool', ev });
        break;
      case 'tool_start': {
        const n = { kind: 'tool', title: `TOOL · ${ev.tool}`, sub: ev.simulated ? 'SIMULATED result' : (ev.source || ''), ts: ev.ts, tone: ev.simulated ? 'b-sim' : 'b-mcp', ev, end: null, errors: [], callId: ev.toolCallId };
        nodes.push(n); byCallId.set(ev.toolCallId, n);
        break;
      }
      case 'tool_end': {
        const n = byCallId.get(ev.toolCallId);
        if (n) { n.end = ev; n.sub = `${ev.success ? 'ok' : 'failed'} · ${fmtDuration(ev.durationMs)}${ev.retries ? ` · ${ev.retries} retr${ev.retries === 1 ? 'y' : 'ies'}` : ''}`; }
        break;
      }
      case 'tool_error': {
        const n = byCallId.get(ev.toolCallId);
        const msg = typeof ev.info === 'string' ? ev.info : ev.info?.error || 'error';
        if (n) n.errors.push(msg);
        else nodes.push({ kind: 'error', title: 'TOOL ERROR', sub: truncate(msg, 140), ts: ev.ts, tone: 'b-error', ev });
        break;
      }
      case 'observation':
        nodes.push({ kind: 'observation', title: 'OBSERVATION', sub: `${ev.tool} → ${truncate(ev.summary || '', 110)}${ev.simulated ? ' · SIMULATED' : ''}`, ts: ev.ts, tone: 'b-observing', ev });
        break;
      case 'approval_requested':
        nodes.push({ kind: 'approval', title: 'WAITING APPROVAL', sub: `${ev.tool} needs a human decision`, ts: ev.ts, tone: 'b-approval', ev, resolved: null });
        break;
      case 'approval_resolved': {
        const last = [...nodes].reverse().find((n) => n.kind === 'approval' && n.resolved == null);
        if (last) { last.resolved = ev.approved; last.sub += ev.approved ? ' → approved' : ' → denied'; }
        break;
      }
      case 'decision':
        nodes.push({ kind: 'decision', title: ev.kind === 'finish' ? 'DECISION · FINISH' : ev.kind === 'guardrail_stop' ? 'DECISION · GUARDRAIL STOP' : 'DECISION · CONTINUE', sub: truncate(ev.detail?.preview || ev.detail?.afterTool || JSON.stringify(ev.detail || ''), 120), ts: ev.ts, tone: 'b-reasoning', ev });
        break;
      case 'final_answer':
        nodes.push({ kind: 'final', title: 'FINAL ANSWER', sub: truncate(ev.text || '', 140), ts: ev.ts, tone: 'b-success', ev });
        break;
      case 'guardrail':
        nodes.push({ kind: 'error', title: 'GUARDRAIL', sub: truncate(ev.violation?.message || '', 140), ts: ev.ts, tone: 'b-error', ev });
        break;
      case 'run_error':
        nodes.push({ kind: 'error', title: 'RUN ERROR', sub: truncate(ev.error || '', 140), ts: ev.ts, tone: 'b-error', ev });
        break;
      case 'run_end':
        nodes.push({ kind: 'runend', title: `RUN ${String(ev.status || '').toUpperCase()}`, sub: ev.metrics ? `${ev.metrics.toolCalls} tool calls · ${fmtDuration(ev.metrics.durationMs)}` : '', ts: ev.ts, tone: ev.status === 'completed' ? 'b-success' : 'b-error', ev });
        break;
      default:
        break;
    }
  }
  return nodes;
}

export function TraceTimeline({ events, onSelect, selected }) {
  const nodes = React.useMemo(() => buildTraceNodes(events), [events]);
  if (!nodes.length) return <div className="empty">No trace yet. Run the agent to generate a step-by-step execution trace.</div>;
  return (
    <div className="trace-flow">
      {nodes.map((n, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div className="tarrow">↓</div>}
          <div
            className={`tnode ${n.kind === 'error' ? 't-error' : ''} ${n.kind === 'approval' ? 't-approval' : ''}`}
            onClick={() => onSelect && onSelect(n)}
            style={selected === n ? { borderColor: 'var(--accent)' } : {}}
          >
            <div className="thead">
              <Badge tone={n.tone}>{n.kind.replace('_', ' ')}</Badge>
              <span className="ttitle">{n.title}</span>
              <span className="ttime">{fmtClock(n.ts)}</span>
            </div>
            {n.sub && <div className="tsub">{n.sub}</div>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export function TraceNodeDetail({ node }) {
  if (!node) return <div className="empty">Select a trace block to inspect its timestamp, input, output, duration and status.</div>;
  const ev = node.ev || {};
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{node.title}</h3>
      <div className="kv"><span className="k">Timestamp</span><span className="v">{new Date(node.ts).toLocaleString()}</span></div>
      <div className="kv"><span className="k">Kind</span><span className="v">{node.kind}</span></div>
      {node.kind === 'tool' && (
        <>
          <div className="kv"><span className="k">Tool</span><span className="v">{ev.tool}</span></div>
          <div className="kv"><span className="k">Source</span><span className="v">{ev.source}{ev.simulated ? ' (SIMULATED)' : ''}</span></div>
          {ev.reason && <div className="kv"><span className="k">Why this tool</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{ev.reason}</span></div>}
          <h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Arguments</h4>
          <JsonView data={ev.arguments} collapsed={false} />
          {node.end && (
            <>
              <div className="kv"><span className="k">Status</span><span className="v">{node.end.success ? 'success' : 'failed'}</span></div>
              <div className="kv"><span className="k">Duration</span><span className="v">{fmtDuration(node.end.durationMs)}</span></div>
              {node.end.retries > 0 && <div className="kv"><span className="k">Retries</span><span className="v">{node.end.retries}</span></div>}
            </>
          )}
          {node.errors.length > 0 && (
            <><h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Errors</h4>
            {node.errors.map((e, i) => <div key={i} className="terminal" style={{ marginBottom: 6 }}><span className="t-err">{e}</span></div>)}</>
          )}
        </>
      )}
      {node.kind === 'observation' && (
        <>
          {ev.simulated && <p><span className="sim-strip">SIMULATED RESULT</span></p>}
          <div className="kv"><span className="k">Tool</span><span className="v">{ev.tool}</span></div>
          <div className="kv"><span className="k">Success</span><span className="v">{String(ev.success)}</span></div>
          <div className="kv"><span className="k">Summary (sent to model)</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{ev.summary}</span></div>
        </>
      )}
      {(node.kind === 'plan') && (
        <ol className="plan-list">{(ev.plan || []).map((s, i) => <li key={i}><span className="pnum">{i + 1}.</span><span>{s}</span></li>)}</ol>
      )}
      {node.kind === 'final' && <div className="terminal"><span className="t-ok">{ev.text}</span></div>}
      {node.kind === 'action' && (
        <>
          <div className="kv"><span className="k">Tool</span><span className="v">{ev.action?.tool}</span></div>
          <div className="kv"><span className="k">Model's explanation</span><span className="v" style={{ fontFamily: 'var(--sans)' }}>{ev.action?.reason || '—'}</span></div>
          <h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Requested arguments</h4>
          <JsonView data={ev.action?.arguments} collapsed={false} />
        </>
      )}
      {['run', 'runend', 'decision', 'think', 'objective', 'error', 'approval'].includes(node.kind) && (
        <>
          <h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Raw event</h4>
          <JsonView data={ev} />
        </>
      )}
    </div>
  );
}
