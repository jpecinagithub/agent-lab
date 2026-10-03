// The model adapter is the ONLY place that talks to an LLM.
// It translates between the harness's internal decision format and whatever the
// model returns, so models are swappable: implement decide() and the harness
// does not care whether the brain is Qwen, another model, or a simulation.
//
// decide({ context, tools, phase }) -> Promise<Decision>
//   phase 'plan': -> { kind:'plan', objective, plan[], note }
//   phase 'act':  -> { kind:'action', action: {type:'tool_call'|'final_answer', ...} }
import { QwenClient, QwenError } from './qwenClient.js';
import { tryParseJson, truncate } from '../utils/format.js';

export { QwenError };

const PLANNER_SYSTEM = `You are the planning module of an educational AI agent harness.
Given the user's request and the list of available tools, produce a JSON object with:
{
  "objective": "one clear sentence restating the user's goal as an agent objective",
  "plan": ["step 1", "step 2", "..."],
  "note": "one short sentence on the strategy (optional)"
}
Rules:
- Output ONLY valid JSON. No markdown fences, no prose.
- The plan is a living draft: 2-6 concrete steps. It may change after tool results.
- Do not invent tool names; only reference tools from the provided list when relevant.`;

const ACTOR_SYSTEM = `You are the decision module of an educational AI agent harness.
You receive the agent's objective, plan, conversation and tool observations.
Decide the SINGLE next action. Either call exactly the tools needed now, or write the final answer.
Rules:
- To gather information or perform an action, call tools. You may call several tools in parallel only if independent.
- After tool results arrive you will see them as observations and can decide again.
- When the objective is achieved, respond with the final answer as plain text (no tool call).
- Never claim you executed a tool yourself: the harness executes tools. You only decide.
- Keep final answers concise and directly address the objective.`;

function buildPlanMessages(context, toolsSummary) {
  return [
    { role: 'system', content: PLANNER_SYSTEM },
    {
      role: 'user',
      content:
        `User request:\n${context.userRequest}\n\n` +
        `Available tools:\n${toolsSummary}\n\n` +
        `Respond with the JSON object only.`
    }
  ];
}

function observationToMessages(obs) {
  const argsJson = JSON.stringify(obs.request?.arguments ?? {});
  const content = JSON.stringify({
    success: obs.success,
    summary: obs.summary,
    data: obs.data ?? null,
    error: obs.error ?? null,
    simulated: obs.simulated === true
  });
  return [
    {
      role: 'assistant',
      content: obs.reason ? `Tool selected: ${obs.tool}. ${obs.reason}` : null,
      tool_calls: [
        { id: obs.toolCallId, type: 'function', function: { name: obs.tool, arguments: argsJson } }
      ]
    },
    { role: 'tool', tool_call_id: obs.toolCallId, content }
  ];
}

function buildActMessages(context) {
  const skillBlock = context.skillsText ? `\n\nActive skill guidance:\n${context.skillsText}` : '';
  const memoryBlock = context.memoryText ? `\n\nMemory:\n${context.memoryText}` : '';
  const planBlock = context.plan?.length
    ? `\n\nCurrent plan:\n${context.plan.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';
  const system =
    `${context.system || ACTOR_SYSTEM}${skillBlock}${memoryBlock}\n\n` +
    `Agent objective: ${context.objective || '(not set yet)'}.${planBlock}`;
  const messages = [{ role: 'system', content: system }];
  for (const m of context.conversation || []) messages.push({ role: m.role, content: m.content });
  for (const obs of context.observations || []) messages.push(...observationToMessages(obs));
  return messages;
}

function toolsSummaryForPlanner(tools) {
  return (tools || [])
    .filter((t) => t.enabled !== false)
    .map((t) => `- ${t.name}: ${t.description || ''}${t.source?.startsWith('mcp:') ? ' [MCP]' : ''}`)
    .join('\n') || '(no tools available)';
}

export function createQwenAdapter(client, settings = {}) {
  if (!(client instanceof QwenClient)) throw new Error('createQwenAdapter needs a QwenClient');

  async function decidePlan(context, tools) {
    const messages = buildPlanMessages(context, toolsSummaryForPlanner(tools));
    let res;
    try {
      res = await client.chat({ messages, tools: [], stream: false });
    } catch (e) {
      throw e;
    }
    const parsed = tryParseJson(res.content || '');
    if (parsed.ok && parsed.value && typeof parsed.value === 'object') {
      const v = parsed.value;
      return {
        kind: 'plan',
        objective: String(v.objective || context.userRequest || '').slice(0, 500),
        plan: Array.isArray(v.plan) ? v.plan.map((s) => String(s).slice(0, 300)).slice(0, 8) : [],
        note: v.note ? String(v.note).slice(0, 300) : ''
      };
    }
    // Fallback: still produce a usable objective/plan instead of crashing the run.
    return {
      kind: 'plan',
      objective: truncate(context.userRequest, 200),
      plan: ['Understand the request', 'Gather needed information with tools if required', 'Produce the final answer'],
      note: 'The model did not return structured JSON; using a generic plan.',
      degraded: true
    };
  }

  async function decideAct(context, tools, onToken) {
    const messages = buildActMessages(context);
    let res;
    try {
      res = await client.chat({ messages, tools, stream: true, onToken: onToken || null });
    } catch (e) {
      // If streaming is not supported by the endpoint, retry once without streaming.
      if (e.code === 'HTTP' || e.code === 'NETWORK') {
        res = await client.chat({ messages, tools, stream: false });
      } else throw e;
    }
    const calls = (res.toolCalls || []).filter((c) => c && c.name);
    if (calls.length > 0) {
      return {
        kind: 'action',
        action: {
          type: 'tool_calls',
          calls: calls.map((c, i) => ({
            id: c.id || `call_${Date.now()}_${i}`,
            tool: c.name,
            arguments: c.arguments || {},
            reason: res.content ? truncate(res.content, 220) : 'The model selected this tool as the next step toward the objective.'
          }))
        }
      };
    }
    return {
      kind: 'action',
      action: { type: 'final_answer', text: res.content || '(The model returned an empty response.)' }
    };
  }

  return {
    id: 'qwen',
    label: `Qwen (${client.model})`,
    isSimulated: false,
    decide: async ({ context, tools, phase, onToken }) => {
      if (phase === 'plan') return decidePlan(context, tools);
      return decideAct(context, tools, onToken);
    }
  };
}

// Chooses the adapter for a run. Falls back to simulation when Qwen is selected
// but no API key is present — the UI surfaces this clearly.
export function resolveAdapter({ mode, client, settings }) {
  if (mode === 'qwen' && client && client.hasKey()) {
    return { adapter: createQwenAdapter(client, settings), simulated: false };
  }
  return { adapter: null, simulated: true, reason: mode === 'qwen' ? 'NO_API_KEY' : 'DEMO_MODE' };
}
