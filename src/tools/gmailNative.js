// Native (REAL) Gmail tools. These call the Gmail API directly from the browser
// with the user's OAuth token — no MCP involved. They replace the SIMULATED
// demo-server versions of the same tools while a Gmail session is connected.
import { getValidGmailToken, silentlyRefreshGmailToken } from './gmailAuth.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function ensureToken(getClientId) {
  let token = getValidGmailToken();
  if (!token) {
    // One silent attempt before asking the user to reconnect.
    token = await silentlyRefreshGmailToken(getClientId());
  }
  if (!token) {
    throw new Error('Gmail is not connected. Connect your Google account in Settings → Gmail (native).');
  }
  return token;
}

async function gmailFetch(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* noop */ }
    throw new Error(`Gmail API error ${res.status}${detail ? `: ${detail}` : ''}.`);
  }
  return res.json();
}

function header(payload, name) {
  const h = (payload?.headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

// Recursively find the first text/plain (fallback: text/html) part and decode it.
function extractBodyText(payload) {
  const b64url = (s) => {
    try {
      const b64 = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch { return ''; }
  };
  const walk = (p, want) => {
    if (!p) return null;
    if (p.mimeType === want && p.body?.data) return b64url(p.body.data);
    for (const part of p.parts || []) {
      const found = walk(part, want);
      if (found) return found;
    }
    return null;
  };
  return walk(payload, 'text/plain') || walk(payload, 'text/html') || '';
}

function toMessageMeta(m) {
  const payload = m.payload || {};
  return {
    id: m.id,
    threadId: m.threadId,
    subject: header(payload, 'subject'),
    from: header(payload, 'from'),
    date: header(payload, 'date'),
    snippet: m.snippet || '',
    labels: m.labelIds || []
  };
}

export function getGmailNativeTools({ getClientId }) {
  return [
    {
      name: 'gmail_search',
      description: 'Searches your REAL Gmail messages via the Gmail API. Returns matching message metadata (id, subject, sender, date, snippet).',
      category: 'gmail',
      source: 'native',
      risk: 'low',
      simulated: false,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Gmail search query, e.g. "is:unread newer_than:7d" or "from:boss@company.com"' },
          maxResults: { type: 'integer', description: 'How many messages to return (1-25).', default: 10 }
        },
        required: ['query']
      },
      handler: async (args) => {
        const token = await ensureToken(getClientId);
        const n = Math.min(Math.max(parseInt(args.maxResults || '10', 10) || 10, 1), 25);
        const list = await gmailFetch(`/messages?q=${encodeURIComponent(args.query)}&maxResults=${n}`, token);
        const ids = (list.messages || []).map((m) => m.id);
        const metas = await Promise.all(
          ids.map((id) => gmailFetch(`/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token).then(toMessageMeta))
        );
        return { count: metas.length, query: args.query, messages: metas, real: true };
      }
    },
    {
      name: 'gmail_get_message',
      description: 'Retrieves the full content of one REAL Gmail message by id via the Gmail API.',
      category: 'gmail',
      source: 'native',
      risk: 'low',
      simulated: false,
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Gmail message id (from gmail_search).' }
        },
        required: ['id']
      },
      handler: async (args) => {
        const token = await ensureToken(getClientId);
        const m = await gmailFetch(`/messages/${encodeURIComponent(args.id)}?format=full`, token);
        const payload = m.payload || {};
        const bodyText = extractBodyText(payload).slice(0, 6000);
        return {
          id: m.id,
          threadId: m.threadId,
          subject: header(payload, 'subject'),
          from: header(payload, 'from'),
          to: header(payload, 'to'),
          date: header(payload, 'date'),
          snippet: m.snippet || '',
          labels: m.labelIds || [],
          bodyText,
          real: true
        };
      }
    }
  ];
}
