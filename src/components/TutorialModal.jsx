import React from 'react';
import { useAgent } from '../state/AgentContext.jsx';

const STEPS = [
  { t: 'Qwen is the brain.', d: 'The model proposes actions — tool calls or a final answer — but it never executes anything itself.' },
  { t: 'The harness is in control.', d: 'It builds the context, validates tool calls, checks permissions, executes tools, and loops until the task is done.' },
  { t: 'Tools give the agent capabilities.', d: 'Each tool is a real function registered by name. The model only ever sees the name, description and schema.' },
  { t: 'MCP connects external systems.', d: 'Gmail and Chrome become tools through the Model Context Protocol: connect → discover → register → call.' },
  { t: 'Memory persists what matters.', d: 'Short-term memory holds the current run; long-term memory keeps facts across runs.' },
  { t: 'The loop enables multi-step work.', d: 'Objective → Plan → Action → Execution → Observation → Decision, repeating until the model finishes.' }
];

export function TutorialModal() {
  const { showTutorial, dismissTutorial, runDemo, setView } = useAgent();
  if (!showTutorial) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Welcome to Agent Lab</h2>
        <p className="lede">This application lets you see how an AI agent works internally — not as a chatbot, but as a <b>harness + model + tools</b> system running a visible loop.</p>
        <div className="tutorial-steps">
          {STEPS.map((s, i) => (
            <div className="tutorial-step" key={i}>
              <div className="tn">{i + 1}</div>
              <p><b>{s.t}</b> {s.d}</p>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { dismissTutorial(); runDemo('calc'); }}>Start demo</button>
          <button className="btn" onClick={() => { dismissTutorial(); setView('settings'); }}>Connect Qwen</button>
          <button className="btn" onClick={dismissTutorial}>Explore on my own</button>
        </div>
      </div>
    </div>
  );
}
