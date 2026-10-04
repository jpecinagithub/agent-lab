import React from 'react';

const EMAIL = 'jpecina@gmail.com';

export function Author() {
  return (
    <div className="page">
      <div className="card">
        <h3>Jon Peciña</h3>
        <p className="hint" style={{ fontSize: 14 }}>AI Engineer</p>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Industrial Engineer turned AI Engineer. I build complete applications — front end, back end,
          testing and DevOps — accelerated by AI tools, with a current focus on <b>AI agents</b> and
          <b> LLM harness engineering</b>: the control systems that turn a language model into a
          reliable, goal-directed agent.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          <b>AGENT LAB</b> is an educational, open project: a real agent harness running entirely in
          the browser, built to show — not just tell — how the loop <i>User → Harness → LLM →
          Decision → Tool → Observation → Final Answer</i> works.
        </p>
      </div>
      <div className="card">
        <h3>Contact</h3>
        <p className="hint">Questions, feedback or collaboration ideas about this lab are welcome.</p>
        <a className="btn btn-primary" href={`mailto:${EMAIL}`}>✉️ {EMAIL}</a>
      </div>
    </div>
  );
}
