// Minimal SSE parser for OpenAI-compatible streaming responses.
export function createStreamParser(callbacks = {}) {
  const { onToken = () => {}, onToolCallDelta = () => {}, onDone = () => {}, onError = () => {} } = callbacks;
  let buffer = '';
  let toolCallFragments = [];

  function processLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') return;
    let json;
    try { json = JSON.parse(payload); } catch { return; }
    const delta = json?.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === 'string' && delta.content) onToken(delta.content);
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        toolCallFragments[idx] = toolCallFragments[idx] || { id: '', name: '', arguments: '' };
        const frag = toolCallFragments[idx];
        if (tc.id) frag.id = tc.id;
        if (tc.function?.name) frag.name += tc.function.name;
        if (tc.function?.arguments) frag.arguments += tc.function.arguments;
        onToolCallDelta(idx, { ...frag });
      }
    }
  }

  return {
    feed(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        try { processLine(line); } catch (e) { onError(e); }
      }
    },
    finish() {
      if (buffer.trim()) { try { processLine(buffer); } catch (e) { onError(e); } }
      const toolCalls = toolCallFragments
        .filter((f) => f && f.name)
        .map((f) => {
          let args = {};
          try { args = f.arguments ? JSON.parse(f.arguments) : {}; } catch { /* keep {} */ }
          return { id: f.id || undefined, name: f.name, arguments: args, _rawArgs: f.arguments };
        });
      onDone({ toolCalls });
      return toolCalls;
    }
  };
}
