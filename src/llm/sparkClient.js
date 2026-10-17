// SparkClient: talks to Muse Spark 1.3 through Jon's own OpenCode gateway.
//
// Why a gateway instead of a model API: OpenCode's free tier only answers
// inside its official client (calling the API directly returns 403
// FreeTierError). The browser therefore POSTs to the Node gateway on Jon's
// server — the same one spark-chat uses — which runs per request:
//     opencode run --format json -m opencode/muse-spark-1.3-contributor-free
// and answers { reply, sessionId }. The API key lives in /opt/spark-chat/.env
// on the server and never reaches the browser.
//
// The gateway is text-in/text-out: it has no native tool-calling. The agent
// loop keeps working because this client teaches the model a strict JSON
// tool-call protocol inside the prompt and parses the fenced block back into
// tool calls. The harness still owns the Tool Registry, the guardrails and
// the trace — only the "intelligence" moved from Qwen to Muse Spark.
//
// Interface mirrors QwenClient.chat({ messages, tools, stream, onToken, signal })
// so adapters can treat both brains the same.
import { tryParseJson } from '../utils/format.js';

export const DEFAULT_GATEWAY_URL = 'https://jpecina.duckdns.org/spark/chat';
export const DEFAULT_SPARK_MODEL = 'muse-spark-1.3';
// opencode runs can take minutes on long answers (gateway timeout is 300 s).
const GATEWAY_TIMEOUT_MS = 300000;

export class SparkError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function toolSchemasForPrompt(tools) {
  return (tools || [])
    .filter((t) => t && t.enabled !== false)
    .map((t) => ({
      name: t.name,
      description: t.description || '',
      parameters: t.parameters || { type: 'object', properties: {} }
    }));
}

const TOOL_PROTOCOL = `
TOOL-CALL PROTOCOL — follow it exactly.
You can call the tools listed below. To call one or more tools, reply with
EXACTLY ONE fenced json block and NOTHING else outside it:

\`\`\`json
{"tool_calls": [{"name": "<tool name>", "arguments": {<arguments as a JSON object>}, "reason": "<one short sentence on why this helps>"}]}
\`\`\`

Rules:
- "name" MUST be exactly one of the tool names listed below.
- "arguments" MUST be a JSON object matching that tool's parameters (use {} if it takes none).
- You may list several tool calls in the array ONLY when they are independent of each other.
- Do NOT narrate, explain or add any text outside the fenced block when calling tools.
- When the objective is complete, do NOT output JSON: write the final answer as plain text for the user.
`;

function renderMessage(m) {
  const role = String(m.role || 'user').toUpperCase();
  // Assistant message that carried OpenAI-style tool calls (replayed observations).
  if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
    const calls = m.tool_calls
      .map((tc) => {
        const fn = tc.function || {};
        let args = fn.arguments;
        if (typeof args !== 'string') { try { args = JSON.stringify(args); } catch { args = '{}'; } }
        return `- ${fn.name || 'unknown'}(${args})`;
      })
      .join('\n');
    const prefix = m.content ? `${m.content}\n` : '';
    return `${prefix}${role} requested tool calls:\n${calls}`;
  }
  // Tool result message (replayed observations).
  if (role === 'TOOL') {
    return `TOOL RESULT for tool_call_id ${m.tool_call_id || '?'}:\n${m.content || ''}`;
  }
  return `${role}:\n${m.content || ''}`;
}

function buildPrompt(messages, tools) {
  const parts = (messages || []).map(renderMessage).filter(Boolean);
  let prompt = parts.join('\n\n');
  const schemas = toolSchemasForPrompt(tools);
  if (schemas.length) {
    prompt += `\n\nAVAILABLE TOOLS (JSON schemas):\n${JSON.stringify(schemas, null, 1)}${TOOL_PROTOCOL}`;
  }
  return prompt;
}

function extractToolCalls(text, knownNames) {
  if (!text || !knownNames.size) return [];
  // 1) Prefer an explicit fenced ```json block (the protocol asks for it).
  let payload = null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  if (fenced) {
    const parsed = tryParseJson(fenced[1].trim());
    if (parsed.ok) payload = parsed.value;
  }
  // 2) Fall back to any JSON object salvaged from the prose.
  if (!payload) {
    const parsed = tryParseJson(text);
    if (parsed.ok) payload = parsed.value;
  }
  if (!payload || typeof payload !== 'object') return [];
  const list = Array.isArray(payload.tool_calls)
    ? payload.tool_calls
    : payload.tool_call
      ? [payload.tool_call]
      : [];
  return list
    .filter((c) => c && typeof c === 'object' && knownNames.has(String(c.name)))
    .map((c, i) => ({
      id: `spark_${Date.now()}_${i}`,
      name: String(c.name),
      arguments: c.arguments && typeof c.arguments === 'object' ? c.arguments : {},
      reason: c.reason ? String(c.reason) : ''
    }));
}

export class SparkClient {
  constructor({ gatewayUrl = DEFAULT_GATEWAY_URL, model = DEFAULT_SPARK_MODEL, timeoutMs = GATEWAY_TIMEOUT_MS } = {}) {
    this.gatewayUrl = String(gatewayUrl || DEFAULT_GATEWAY_URL).replace(/\/+$/, '');
    this.model = model || DEFAULT_SPARK_MODEL;
    this.timeoutMs = timeoutMs;
  }

  // No key is needed in the browser: the gateway holds OPENCODE_API_KEY server-side.
  hasKey() { return true; }

  async chat({ messages, tools = [], stream = false, onToken = null, signal = null } = {}) {
    const prompt = buildPrompt(messages, tools);
    const knownNames = new Set(toolSchemasForPrompt(tools).map((t) => t.name));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const combined = signal
      ? (() => { const c = new AbortController(); signal.addEventListener('abort', () => c.abort()); controller.signal.addEventListener('abort', () => c.abort()); return c.signal; })()
      : controller.signal;

    let res;
    try {
      // No sessionId: every harness decision starts a fresh `opencode run` so the
      // harness — not the CLI session — stays the single owner of the context.
      res = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, messages: [{ role: 'user', content: prompt }] }),
        signal: combined
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') throw new SparkError('Request timed out or was cancelled.', 'TIMEOUT');
      throw new SparkError(`Network error: ${e.message}`, 'NETWORK');
    }
    clearTimeout(timeout);

    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const detail = data?.error || '';
      const code = res.status === 429 ? 'RATE_LIMIT' : 'HTTP';
      throw new SparkError(`OpenCode gateway request failed (${res.status}). ${detail}`.trim(), code);
    }
    if (data?.error) throw new SparkError(`OpenCode gateway error: ${data.error}`, 'GATEWAY');

    const text = String(data?.reply ?? '');
    const toolCalls = extractToolCalls(text, knownNames);
    // The gateway answers whole; emulate streaming so the UI keeps its typing effect.
    if (stream && typeof onToken === 'function' && text) {
      const chunk = 60;
      for (let i = 0; i < text.length; i += chunk) onToken(text.slice(i, i + chunk));
    }
    return { content: text, toolCalls, usage: null, raw: data };
  }

  async ping() {
    const r = await this.chat({
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      stream: false
    });
    return r.content;
  }
}
