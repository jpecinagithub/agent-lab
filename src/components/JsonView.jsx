import React, { useState } from 'react';
import { safeJson, truncate } from '../utils/format.js';

export function JsonView({ data, collapsed = true, maxPreview = 400 }) {
  const [open, setOpen] = useState(!collapsed);
  const full = safeJson(data);
  if (!open) {
    return (
      <div>
        <button className="json-toggle" onClick={() => setOpen(true)}>
          ▸ show JSON ({full.length} chars)
        </button>
        <div className="json-view"><pre>{truncate(full, maxPreview)}</pre></div>
      </div>
    );
  }
  return (
    <div>
      <button className="json-toggle" onClick={() => setOpen(false)}>▾ hide JSON</button>
      <div className="json-view"><pre>{full}</pre></div>
    </div>
  );
}
