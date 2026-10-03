// Qwen client over an OpenAI-compatible HTTP endpoint (e.g. DashScope compatible-mode).
// Transport only: it knows nothing about the agent loop. The modelAdapter decides
// what to ask and how to interpret the answer.
import { createStreamParser } from './streamParser.js';

export const DEFAULT_ENDPOINT = 'https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_MODEL = 'qwen3.8-flash';
const MANAGED_PROXY_ENDPOINT = '/api/qwen';

export class QwenError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export class QwenClient {
  constructor({ endpoint = DEFAULT_ENDPOINT, apiKey = '', model = DEFAULT_MODEL, temperature = 0.7, maxTokens = 2000, timeoutMs = 60000 } = {}) {
    this.endpoint = String(endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, '');
    this.apiKey = apiKey || '';
    this.model = model || DEFAULT_MODEL;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.timeoutMs = timeoutMs;
  }

  get usesManagedProxy() { return this.endpoint === DEFAULT_ENDPOINT; }

  get url() {
    // The same-origin route is handled by Vite locally and by api/qwen.js on
    // Vercel. This avoids CORS and keeps the production API key server-side.
    if (this.usesManagedProxy) return MANAGED_PROXY_ENDPOINT;
    return `${this.endpoint}/chat/completions`;
  }

  hasKey() { return this.usesManagedProxy || Boolean(this.apiKey); }

  toOpenAITools(tools) {
    return (tools || [])
      .filter((t) => t && t.enabled !== false)
      .map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: t.parameters || { type: 'object', properties: {} }
        }
      }));
  }

  async chat({ messages, tools = [], stream = false, onToken = null, signal = null }) {
    if (!this.hasKey()) {
      throw new QwenError('No API key configured. Add one in Settings, or use Demo mode.', 'NO_API_KEY');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const combined = signal
      ? (() => { const c = new AbortController(); signal.addEventListener('abort', () => c.abort()); controller.signal.addEventListener('abort', () => c.abort()); return c.signal; })()
      : controller.signal;

    const body = {
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream
    };
    const openAITools = this.toOpenAITools(tools);
    if (openAITools.length) {
      body.tools = openAITools;
      body.tool_choice = 'auto';
    }

    let res;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify(body),
        signal: combined
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') throw new QwenError('Request timed out or was cancelled.', 'TIMEOUT');
      throw new QwenError(`Network error: ${e.message}`, 'NETWORK');
    }
    clearTimeout(timeout);

    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j?.error?.message || j?.message || ''; } catch { /* ignore */ }
      const code = res.status === 401 || res.status === 403 ? 'AUTH' : res.status === 429 ? 'RATE_LIMIT' : 'HTTP';
      throw new QwenError(`LLM request failed (${res.status}). ${detail}`.trim(), code);
    }

    if (!stream) {
      const json = await res.json();
      const choice = json?.choices?.[0]?.message || {};
      const toolCalls = (choice.tool_calls || []).map((tc) => {
        let args = {};
        try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; }
        catch { args = { _unparseable: tc.function?.arguments }; }
        return { id: tc.id, name: tc.function?.name, arguments: args };
      });
      return {
        content: choice.content || '',
        toolCalls,
        usage: json?.usage || null,
        raw: json
      };
    }

    // Streaming path
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    const parser = createStreamParser({
      onToken: (t) => { content += t; if (onToken) onToken(t); },
      onError: () => {}
    });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      if (signal?.aborted) { reader.cancel(); throw new QwenError('Cancelled.', 'CANCELLED'); }
    }
    const toolCalls = parser.finish();
    return { content, toolCalls, usage: null, raw: null };
  }

  async ping() {
    const r = await this.chat({
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      stream: false
    });
    return r.content;
  }
}
