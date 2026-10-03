import React from 'react';
import { useAgent } from '../state/AgentContext.jsx';
import { InfoIcon } from './InfoIcon.jsx';

export function ControlPanel({ compact = false }) {
  const { runtime, ui, settings, updateSettings } = useAgent();
  const running = !['IDLE', 'COMPLETED', 'FAILED', 'STOPPED'].includes(ui.state);
  const paused = ui.state === 'PAUSED';

  return (
    <div>
      <div className="control-panel">
        <button className="btn btn-primary" disabled={running && !paused} onClick={() => runtime.resume()} title="Run / resume">
          {paused ? 'Resume' : 'Run'}
        </button>
        <button className="btn" disabled={!running || paused} onClick={() => runtime.pause()} title="Pause at the next stage boundary">Pause</button>
        <button className="btn" disabled={!running} onClick={() => runtime.step()} title="Advance exactly one stage">Step</button>
        <button className="btn btn-danger" disabled={!running} onClick={() => runtime.stop()} title="Stop the run">Stop</button>
        <button className="btn" onClick={() => runtime.reset()} title="Reset the harness to idle">Reset</button>
      </div>
      {!compact && (
        <div className="toggle-row">
          <span>Step mode <InfoIcon topic="loop" inline /> <span style={{ color: 'var(--faint)', fontSize: 11 }}>(advance Objective → Plan → Action → Execution → Observation → Decision manually)</span></span>
          <button
            className={`switch ${settings.stepMode ? 'on' : ''}`}
            onClick={() => { updateSettings({ stepMode: !settings.stepMode }); runtime.setStepMode(!settings.stepMode); }}
            aria-label="Toggle step mode"
          />
        </div>
      )}
    </div>
  );
}
