import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { TraceTimeline, TraceNodeDetail } from '../components/TraceTimeline.jsx';
import { ContextInspector } from '../components/ContextInspector.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { MetricsCards } from '../components/MetricsCards.jsx';

export function Trace() {
  const { logger, traceVersion, contextInfo, history } = useAgent();
  const [selected, setSelected] = useState(null);
  const events = logger.getEvents();
  const lastRun = history[0];
  const metrics = lastRun?.metrics;

  return (
    <div className="page-wide">
      <div className="card">
        <h3>Execution trace <InfoIcon topic="trace" /></h3>
        <p className="hint">Every run generates this visual trace. Click any block to inspect its timestamp, input, output, duration and status. Past runs live in <b>History</b>.</p>
      </div>
      <div className="agent-layout" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
        <div className="card">
          <TraceTimeline events={events} onSelect={setSelected} selected={selected} />
        </div>
        <div>
          <div className="card" style={{ position: 'sticky', top: 0 }}>
            <TraceNodeDetail node={selected} />
          </div>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Context inspector <InfoIcon topic="context" /></h3>
          <p className="hint">Exactly what the model sees, section by section — updated live during the run.</p>
          <ContextInspector contextInfo={contextInfo} />
        </div>
        <div className="card">
          <h3>Run metrics</h3>
          <p className="hint">Observability for the latest completed run.</p>
          <MetricsCards metrics={metrics} />
        </div>
      </div>
    </div>
  );
}
