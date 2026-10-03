// SIMULATED model for Demo mode. This is NOT a real LLM: it is a small,
// fully transparent rule-based "brain" that implements the same decide()
// interface as the Qwen adapter, so students can watch the REAL harness loop
// (objective -> plan -> action -> tool -> observation -> decision) run without
// API credentials. Every simulated result is labeled SIMULATED in the UI.
import { truncate } from '../utils/format.js';

function stripCommas(s) { return String(s).replace(/,/g, ''); }

function parseCalculation(text) {
  const t = stripCommas(text);
  let m = t.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i) ||
          t.match(/(\d+(?:\.\d+)?)\s*percent\s*of\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    const pct = parseFloat(m[1]); const base = parseFloat(m[2]);
    return { expression: `${base}*(${pct}/100)`, description: `${m[1]}% of ${m[2]}` };
  }
  const ops = [
    [/(\d+(?:\.\d+)?)\s*(?:plus|\+)\s*(\d+(?:\.\d+)?)/i, '+'],
    [/(\d+(?:\.\d+)?)\s*(?:minus|−|\-)\s*(\d+(?:\.\d+)?)/i, '-'],
    [/(\d+(?:\.\d+)?)\s*(?:times|multiplied by|\*|×)\s*(\d+(?:\.\d+)?)/i, '*'],
    [/(\d+(?:\.\d+)?)\s*(?:divided by|over|\/|÷)\s*(\d+(?:\.\d+)?)/i, '/']
  ];
  for (const [re, op] of ops) {
    m = t.match(re);
    if (m) return { expression: `${m[1]}${op}${m[2]}`, description: `${m[1]} ${op} ${m[2]}` };
  }
  return null;
}

function detectIntents(text) {
  const t = text.toLowerCase();
  const url = (text.match(/https?:\/\/[^\s)"]+/i) || [])[0] || null;
  const browse = /\b(open|browse|navigate|website|web ?page|web ?site)\b/i.test(t) || /summariz.*page|page.*summariz/i.test(t);
  return {
    calc: parseCalculation(text),
    remember: /\b(remember|save it|store it|memori[sz]e|keep it|don't forget)\b/i.test(t),
    email: /\b(inbox|e-?mails?\b|gmail|messages)\b/i.test(t) && !/\b(remember|save it)\b/i.test(t),
    browse,
    time: /\b(what time|current time|what date|today's date|the date)\b/i.test(t),
    random: /\brandom\b/i.test(t),
    // A URL that is being *browsed* is handled by the Chrome tools, not by a raw fetch.
    fetchUrl: !browse ? url : null,
    url: url || 'https://example.com'
  };
}

function toolAvailable(tools, name) {
  return (tools || []).some((t) => t.name === name && t.enabled !== false);
}
function observed(observations, toolName) {
  return (observations || []).find((o) => o.tool === toolName);
}
function lastFailed(observations) {
  const obs = (observations || []).filter((o) => !o.success);
  return obs.length ? obs[obs.length - 1] : null;
}

function toolCall(tool, args, reason) {
  return { kind: 'action', action: { type: 'tool_calls', calls: [{ tool, arguments: args, reason }] } };
}
function finalAnswer(text) {
  return { kind: 'action', action: { type: 'final_answer', text } };
}

export function createSimulatedAdapter() {
  return {
    id: 'simulated',
    label: 'Simulated model (demo)',
    isSimulated: true,
    decide: async ({ context, tools, phase }) => {
      const request = context.userRequest || '';
      const intents = detectIntents(request);
      const obs = context.observations || [];

      if (phase === 'plan') {
        const plan = [];
        let objective = '';
        if (intents.calc) {
          objective = `Compute ${intents.calc.description} and present the result${intents.remember ? ', then store it in memory' : ''}.`;
          plan.push('Parse the arithmetic expression', 'Call the calculator tool');
          if (intents.remember) plan.push('Save the result with save_memory');
          plan.push('Present the final answer');
        } else if (intents.email) {
          objective = 'Inspect the recent Gmail messages and identify which ones require action.';
          plan.push('Search recent inbox messages', 'Review message importance', 'Summarize the actionable items');
        } else if (intents.browse) {
          objective = `Open ${intents.url} and summarize its main page.`;
          plan.push('Navigate to the website with the browser tool', 'Read the page content', 'Summarize the findings');
        } else if (intents.time) {
          objective = 'Tell the user the current date and time.';
          plan.push('Call get_current_time', 'Present the result');
        } else if (intents.random) {
          objective = 'Generate a random number for the user.';
          plan.push('Call generate_random_number', 'Present the result');
        } else if (intents.fetchUrl) {
          objective = `Fetch ${intents.fetchUrl} and summarize what was retrieved.`;
          plan.push('Call fetch_url', 'Summarize the result');
        } else {
          objective = `Respond to the user's request: "${truncate(request, 140)}"`;
          plan.push('Understand the request', 'Provide a direct, helpful answer');
        }
        return {
          kind: 'plan', objective, plan,
          note: 'Demo brain: a transparent rule-based planner standing in for Qwen. Connect Qwen in Settings for real reasoning.'
        };
      }

      // ---- act phase ----
      const failed = lastFailed(obs);
      if (failed) {
        return finalAnswer(
          `I ran into a problem while using the tool "${failed.tool}": ${failed.error || 'unknown error'}. ` +
          `The harness caught the error so the run could end gracefully instead of crashing. ` +
          `(This is the simulated demo model. Connect Qwen in Settings to retry with a real model.)`
        );
      }

      // 1) calculation
      if (intents.calc && !observed(obs, 'calculator') && toolAvailable(tools, 'calculator')) {
        return toolCall('calculator', { expression: intents.calc.expression },
          `I need the numeric value of ${intents.calc.description} before I can answer or remember it.`);
      }
      // 2) remember the calc result
      if (intents.calc && intents.remember && !observed(obs, 'save_memory') && toolAvailable(tools, 'save_memory')) {
        const calcObs = observed(obs, 'calculator');
        const value = calcObs && calcObs.success ? String(calcObs.data?.result ?? '') : '';
        return toolCall('save_memory',
          { key: 'calculation_result', value, note: `${intents.calc.description} — requested by user` },
          'The user explicitly asked to remember the result, so I am storing it in long-term memory.');
      }
      // 3) email via (simulated) Gmail MCP
      if (intents.email && !observed(obs, 'gmail_search') && toolAvailable(tools, 'gmail_search')) {
        return toolCall('gmail_search', { query: 'is:unread newer_than:7d', maxResults: 10 },
          'I need recent email data to determine what requires action.');
      }
      // 4) browser via (simulated) Chrome MCP
      if (intents.browse && !observed(obs, 'browser_navigate') && toolAvailable(tools, 'browser_navigate')) {
        return toolCall('browser_navigate', { url: intents.url },
          'I need to load the page before I can read or summarize it.');
      }
      if (intents.browse && observed(obs, 'browser_navigate') && !observed(obs, 'browser_read_page') && toolAvailable(tools, 'browser_read_page')) {
        return toolCall('browser_read_page', {},
          'The page is loaded; now I will extract its content for the summary.');
      }
      // 5) time / random / fetch
      if (intents.time && !observed(obs, 'get_current_time') && toolAvailable(tools, 'get_current_time')) {
        return toolCall('get_current_time', {}, 'The user asked for the current time, so I will read the system clock.');
      }
      if (intents.random && !observed(obs, 'generate_random_number') && toolAvailable(tools, 'generate_random_number')) {
        return toolCall('generate_random_number', { min: 1, max: 100 }, 'The user wants a random number; I will generate one.');
      }
      if (intents.fetchUrl && !observed(obs, 'fetch_url') && toolAvailable(tools, 'fetch_url')) {
        return toolCall('fetch_url', { url: intents.fetchUrl }, 'I need to retrieve the URL content before summarizing it.');
      }

      // ---- final answers ----
      if (intents.calc) {
        const calcObs = observed(obs, 'calculator');
        const result = calcObs?.success ? calcObs.data?.result : null;
        const saved = observed(obs, 'save_memory');
        let text = result != null
          ? `${intents.calc.description} = ${result}.`
          : `I could not compute "${request}".`;
        if (saved?.success) text += ` Saved to memory as "calculation_result".`;
        return finalAnswer(text + '\n\n(SIMULATED DEMO RESULT — a simulated brain drove this run. Connect Qwen in Settings for real reasoning.)');
      }
      if (intents.email) {
        const gObs = observed(obs, 'gmail_search');
        const msgs = gObs?.success ? (gObs.data?.messages || []) : [];
        const actionable = msgs.filter((m) => m.requiresAction);
        let text = `I checked your inbox (SIMULATED Gmail MCP demo — ${msgs.length} recent messages).\n\n`;
        text += actionable.length
          ? `Messages that require action:\n${actionable.map((m) => `• ${m.subject} — from ${m.from} (${m.why})`).join('\n')}`
          : 'Nothing in the recent messages looks like it requires action.';
        const others = msgs.filter((m) => !m.requiresAction);
        if (others.length) text += `\n\nFYI (no action needed):\n${others.map((m) => `• ${m.subject} — from ${m.from}`).join('\n')}`;
        return finalAnswer(text);
      }
      if (intents.browse) {
        const rObs = observed(obs, 'browser_read_page');
        const content = rObs?.success ? rObs.data?.text : null;
        const nObs = observed(obs, 'browser_navigate');
        const urlShown = nObs?.success ? (nObs.data?.url || intents.url) : intents.url;
        const text = content
          ? `I opened ${urlShown} (SIMULATED Chrome MCP demo) and read the main page.\n\nSummary:\n${truncate(content, 900)}`
          : `I could not load ${urlShown}.`;
        return finalAnswer(text);
      }
      if (intents.time) {
        const tObs = observed(obs, 'get_current_time');
        return finalAnswer(tObs?.success ? `Current date and time: ${tObs.data?.iso} (${tObs.data?.timezone}).` : 'I could not read the clock.');
      }
      if (intents.random) {
        const rObs = observed(obs, 'generate_random_number');
        return finalAnswer(rObs?.success ? `Your random number between ${rObs.data?.min} and ${rObs.data?.max} is: ${rObs.data?.value}.` : 'I could not generate a number.');
      }
      if (intents.fetchUrl) {
        const fObs = observed(obs, 'fetch_url');
        return finalAnswer(fObs?.success
          ? `Fetched ${intents.fetchUrl} (${fObs.data?.bytes} bytes, status ${fObs.data?.status}).\n\n${truncate(fObs.data?.text, 800)}`
          : `I could not fetch ${intents.fetchUrl}: ${fObs?.error || 'unknown error'}`);
      }
      return finalAnswer(
        `You said: "${truncate(request, 200)}"\n\n` +
        `I'm running in Demo mode with a simulated brain, which only handles the built-in demo scenarios ` +
        `(calculations, memory, the simulated Gmail inbox, the simulated browser, time, random numbers, fetching a URL). ` +
        `For anything else, connect a real Qwen model in Settings — then the same harness loop will reason over your request for real.`
      );
    }
  };
}
