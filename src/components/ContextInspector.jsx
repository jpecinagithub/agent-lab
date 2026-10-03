import React, { useState } from 'react';
import { InfoIcon } from './InfoIcon.jsx';

// Shows exactly what is sent to the model, section by section.
export function ContextInspector({ contextInfo }) {
  const [open, setOpen] = useState({});
  if (!contextInfo) return <div className="empty">The context inspector will populate while the agent runs.</div>;
  const sections = contextInfo.sections || [];
  return (
    <div>
      <div className="kv">
        <span className="k">Total size <InfoIcon topic="context" inline /></span>
        <span className="v">{(contextInfo.totalChars || 0).toLocaleString()} chars ≈ {(contextInfo.totalTokens || 0).toLocaleString()} tokens</span>
      </div>
      <div style={{ height: 10 }} />
      {sections.map((s) => {
        const isOpen = !!open[s.name];
        return (
          <div className="ctx-section" key={s.name}>
            <div className="ctx-head" onClick={() => setOpen((o) => ({ ...o, [s.name]: !o[s.name] }))}>
              <span>{isOpen ? '▾' : '▸'}</span> {s.name}
              <span className="tok">≈ {s.tokens.toLocaleString()} tok</span>
            </div>
            {isOpen && (
              <div className="ctx-body"><pre>{s.text?.slice(0, 6000) || '(empty)'}{s.text && s.text.length > 6000 ? '\n…truncated in view…' : ''}</pre></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
