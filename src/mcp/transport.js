// Browser-compatible MCP transport: JSON-RPC 2.0 over HTTP POST,
// with optional SSE stream for server-pushed notifications.
export class McpTransportError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

export class McpTransport {
  constructor({ endpoint, authToken = '', timeoutMs = 20000 }) {
    this.endpoint = endpoint;
    this.authToken = authToken;
    this.timeoutMs = timeoutMs;
    this.sseController = null;
  }

  headers() {
    const h = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (this.authToken) h.Authorization = `Bearer ${this.authToken}`;
    return h;
  }

  async rpc(method, params = {}) {
    const id = `rpc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      throw new McpTransportError(
        e.name === 'AbortError' ? 'MCP request timed out.' : `MCP network error: ${e.message}`,
        'MCP_TIMEOUT'
      );
    }
    clearTimeout(timer);
    const text = await res.text();
    if (!res.ok) throw new McpTransportError(`MCP HTTP ${res.status}: ${text.slice(0, 200)}`, 'MCP_HTTP');
    let json;
    try { json = JSON.parse(text); } catch { throw new McpTransportError('MCP server did not return JSON-RPC.', 'MCP_PROTOCOL'); }
    if (json.error) throw new McpTransportError(`MCP error ${json.error.code}: ${json.error.message}`, 'MCP_RPC');
    return json.result;
  }

  // Opens an SSE stream for servers that push notifications/logs.
  openEventStream(onEvent) {
    this.closeEventStream();
    this.sseController = new AbortController();
    const ctrl = this.sseController;
    (async () => {
      try {
        const res = await fetch(this.endpoint, { headers: this.headers(), signal: ctrl.signal });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data:'));
            if (line) { try { onEvent(JSON.parse(line.slice(5).trim())); } catch { /* ignore */ } }
          }
        }
      } catch { /* stream closed */ }
    })();
    return () => this.closeEventStream();
  }

  closeEventStream() {
    try { this.sseController?.abort(); } catch { /* noop */ }
    this.sseController = null;
  }
}
