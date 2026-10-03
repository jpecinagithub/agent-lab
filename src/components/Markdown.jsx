import React from 'react';

// Tiny safe markdown renderer for chat bubbles: escapes HTML, then supports
// **bold**, *italic*, `code`, ``` blocks, - lists and line breaks.
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function Markdown({ text }) {
  const html = React.useMemo(() => {
    let t = escapeHtml(String(text || ''));
    const blocks = [];
    t = t.replace(/```([\s\S]*?)```/g, (_, code) => {
      blocks.push(`<pre class="json-view" style="margin:8px 0"><code>${code}</code></pre>`);
      return `\u0000${blocks.length - 1}\u0000`;
    });
    t = t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`\n]+)`/g, '<code style="font-family:var(--mono);font-size:12px;background:#0c1017;padding:1px 5px;border-radius:4px">$1</code>');
    const lines = t.split('\n');
    const out = [];
    let inList = false;
    for (const line of lines) {
      if (/^\s*[•\-*]\s+/.test(line)) {
        if (!inList) { out.push('<ul style="margin:6px 0;padding-left:20px">'); inList = true; }
        out.push(`<li>${line.replace(/^\s*[•\-*]\s+/, '')}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(line === '' ? '<br/>' : `<span>${line}</span><br/>`);
      }
    }
    if (inList) out.push('</ul>');
    let joined = out.join('');
    joined = joined.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
    return joined;
  }, [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
