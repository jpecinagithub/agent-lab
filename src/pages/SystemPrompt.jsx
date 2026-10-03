import React, { useState } from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from '../components/InfoIcon.jsx';
import { DEFAULT_SYSTEM_PROMPT } from '../config.js';
import { estimateTokens } from '../utils/tokens.js';

export function SystemPrompt() {
  const { settings, updateSettings, skills, memory, pushNotice } = useAgent();
  const [draft, setDraft] = useState(settings.systemPrompt);
  const dirty = draft !== settings.systemPrompt;

  const save = () => {
    updateSettings({ systemPrompt: draft });
    pushNotice('info', 'System prompt updated. It applies to the next run.');
  };

  return (
    <div className="page">
      <div className="card">
        <h3>System prompt <InfoIcon topic="context" /></h3>
        <p className="hint">The standing instructions prepended to every model call — the first section of the agent context. Edit it and watch how the agent's behavior changes.</p>
        <textarea className="textarea" rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="kv"><span className="k">Size</span><span className="v">{draft.length.toLocaleString()} chars ≈ {estimateTokens(draft).toLocaleString()} tokens</span></div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary" disabled={!dirty} onClick={save}>Save system prompt</button>
          <button className="btn" onClick={() => setDraft(DEFAULT_SYSTEM_PROMPT)}>Reset to default</button>
        </div>
      </div>
      <div className="card">
        <h3>What the model actually receives</h3>
        <p className="hint">System prompt + active skill + memory, in that order — the top of every context.</p>
        <div className="json-view"><pre style={{ whiteSpace: 'pre-wrap' }}>{`${draft}\n\n${skills.injectText()}\n\n${memory.buildMemoryText() || '(memory empty)'}`.slice(0, 4000)}</pre></div>
      </div>
    </div>
  );
}
