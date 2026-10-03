// Built-in native tools. Registered at startup; inspectable in the Tools view.
import { evaluateExpression } from '../utils/mathParser.js';

function stripHtml(html, maxChars) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxChars);
}

export function getBuiltinTools() {
  return [
    {
      name: 'calculator',
      description: 'Evaluates a mathematical expression safely (supports + - * / % ^ and parentheses).',
      category: 'utilities',
      risk: 'low',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'e.g. "2450*(18/100)"' }
        },
        required: ['expression']
      },
      handler: async (args) => {
        const result = evaluateExpression(args.expression);
        return { expression: args.expression, result };
      }
    },
    {
      name: 'get_current_time',
      description: 'Returns the current date and time from the system clock.',
      category: 'utilities',
      risk: 'low',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        const now = new Date();
        return {
          iso: now.toISOString(),
          local: now.toLocaleString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          unixMs: now.getTime()
        };
      }
    },
    {
      name: 'generate_random_number',
      description: 'Generates a random integer within an inclusive range.',
      category: 'utilities',
      risk: 'low',
      parameters: {
        type: 'object',
        properties: {
          min: { type: 'integer', description: 'Lower bound (inclusive)', default: 1 },
          max: { type: 'integer', description: 'Upper bound (inclusive)', default: 100 }
        }
      },
      handler: async (args) => {
        const min = args.min ?? 1;
        const max = args.max ?? 100;
        if (min > max) throw new Error('min must be <= max');
        const value = Math.floor(Math.random() * (max - min + 1)) + min;
        return { min, max, value };
      }
    },
    {
      name: 'save_memory',
      description: 'Stores a fact in long-term memory so the agent can recall it in future runs.',
      category: 'memory',
      risk: 'low',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Short identifier, e.g. "calculation_result"' },
          value: { type: 'string', description: 'The fact to remember' },
          note: { type: 'string', description: 'Optional context about why this was saved' }
        },
        required: ['key', 'value']
      },
      handler: async (args, context) => {
        if (!context.memory) throw new Error('Memory is not available in this context.');
        const entry = context.memory.remember(args.key, args.value, args.note || '');
        return { saved: true, entry: { key: entry.key, value: entry.value, updatedAt: entry.updatedAt } };
      }
    },
    {
      name: 'search_memory',
      description: 'Searches long-term memory for facts matching a query.',
      category: 'memory',
      risk: 'low',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
          limit: { type: 'integer', description: 'Max results', default: 5 }
        },
        required: ['query']
      },
      handler: async (args, context) => {
        if (!context.memory) throw new Error('Memory is not available in this context.');
        const results = context.memory.search(args.query, args.limit ?? 5);
        return { query: args.query, count: results.length, results };
      }
    },
    {
      name: 'clear_memory',
      description: 'Deletes ALL long-term memory entries. Irreversible.',
      category: 'memory',
      risk: 'high',
      requiresApproval: true,
      parameters: {
        type: 'object',
        properties: {
          confirm: { type: 'boolean', description: 'Must be true to proceed' }
        },
        required: ['confirm']
      },
      handler: async (args, context) => {
        if (args.confirm !== true) throw new Error('Refusing to clear memory: confirm must be true.');
        if (!context.memory) throw new Error('Memory is not available in this context.');
        const removed = context.memory.clear();
        return { cleared: true, removed };
      }
    },
    {
      name: 'fetch_url',
      description: 'Fetches a URL and returns its text content (HTML stripped). Subject to browser CORS rules.',
      category: 'web',
      risk: 'low',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full http(s) URL' },
          maxChars: { type: 'integer', description: 'Max characters of text to return', default: 4000 }
        },
        required: ['url']
      },
      handler: async (args, context) => {
        let url;
        try { url = new URL(args.url); } catch { throw new Error('Invalid URL.'); }
        if (!/^https?:$/.test(url.protocol)) throw new Error('Only http(s) URLs are allowed.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(url.toString(), { signal: controller.signal });
          const raw = await res.text();
          const text = stripHtml(raw, args.maxChars ?? 4000);
          return { url: url.toString(), status: res.status, bytes: raw.length, text };
        } catch (e) {
          if (e.name === 'AbortError') throw new Error('Fetch timed out after 15s.');
          throw new Error(`Fetch failed (often CORS in the browser): ${e.message}`);
        } finally {
          clearTimeout(timer);
        }
      }
    }
  ];
}
