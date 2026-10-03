import React, { useState, useRef, useEffect } from 'react';
import { EDU } from '../config.js';

// Educational info icon: every important concept explains itself.
export function InfoIcon({ topic, inline = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);
  const info = EDU[topic];
  if (!info) return null;

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      const w = 340;
      setPos({
        x: Math.min(Math.max(8, r.left - w / 2 + 10), window.innerWidth - w - 12),
        y: r.bottom + 8
      });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open ]);

  return (
    <>
      <i
        ref={ref}
        className="info-icon"
        style={inline ? { marginLeft: 6 } : {}}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => { e.stopPropagation(); open ? hide() : show(); }}
        title={info.title}
      >i</i>
      {open && (
        <div className="edu-pop" style={{ left: pos.x, top: pos.y }} onMouseEnter={show} onMouseLeave={hide}>
          <h4>{info.title}</h4>
          <p>{info.body}</p>
        </div>
      )}
    </>
  );
}
