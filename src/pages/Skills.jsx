import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { Badge } from '../components/StatusBadge.jsx';

export function Skills() {
  const { skills } = useAgent();
  const [active, setActive] = useState(skills.getActive()?.id);
  const [preview, setPreview] = useState(null);

  const activate = (id) => {
    skills.setActive(id);
    setActive(id);
  };

  return (
    <div className="page">
      <div className="card">
        <h3>Skills <InfoIcon topic="skills" /></h3>
        <p className="hint">A skill is reusable <b>guidance</b> injected into the model's context — not code, not a new tool. It changes <i>how</i> the agent reasons. One skill is active at a time; the active skill's text is visible in the Context Inspector.</p>
      </div>
      <div className="grid grid-3">
        {skills.list().map((s) => (
          <div key={s.id} className={`skill-card ${active === s.id ? 'active' : ''}`}>
            <h4>{s.name} {active === s.id && <Badge tone="b-success">active</Badge>}</h4>
            <p>{s.description}</p>
            <div className="btn-row">
              {active !== s.id && <button className="btn btn-sm btn-primary" onClick={() => activate(s.id)}>Activate</button>}
              <button className="btn btn-sm" onClick={() => setPreview(preview === s.id ? null : s.id)}>{preview === s.id ? 'Hide guidance' : 'Preview guidance'}</button>
            </div>
            {preview === s.id && (
              <div className="json-view" style={{ marginTop: 10 }}><pre style={{ whiteSpace: 'pre-wrap' }}>{s.guidance}</pre></div>
            )}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Currently injected</h3>
        <div className="json-view"><pre style={{ whiteSpace: 'pre-wrap' }}>{skills.injectText() || '(none)'}</pre></div>
      </div>
    </div>
  );
}
