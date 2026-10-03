// In-process DEMO MCP servers. They implement the same interface as a real MCP
// server (connect / listTools / callTool) but return clearly-labeled SIMULATED
// data so students can learn the architecture without credentials or a browser
// extension. Real browser control is never faked: without a real MCP server,
// these simulations are the honest stand-in.
export const DEMO_SERVER_DEFS = [
  { id: 'mcp-gmail-demo', kind: 'gmail', name: 'Gmail (Demo)', endpoint: 'demo://gmail-mcp' },
  { id: 'mcp-chrome-demo', kind: 'chrome', name: 'Chrome Browser (Demo)', endpoint: 'demo://chrome-mcp' }
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const DEMO_EMAILS = [
  {
    id: 'msg_101', from: 'billing@acme-corp.com', to: 'me', subject: 'Invoice #INV-2041 due Friday — €1,240.00',
    date: '2026-10-02', snippet: 'Your invoice #INV-2041 for €1,240.00 is due this Friday. Please arrange payment...',
    requiresAction: true, why: 'Invoice of €1,240 due in 2 days — needs payment or scheduling'
  },
  {
    id: 'msg_102', from: 'manager@company.com', to: 'me', subject: 'Re: Q3 planning session — please confirm',
    date: '2026-10-02', snippet: 'Hi, could you confirm your attendance for Thursday’s planning session?...',
    requiresAction: true, why: 'Needs your confirmation by Thursday'
  },
  {
    id: 'msg_103', from: 'security@accounts.com', to: 'me', subject: 'New sign-in from an unknown device',
    date: '2026-10-01', snippet: 'We noticed a sign-in from a device we don’t recognize (Lisbon, PT)...',
    requiresAction: true, why: 'Verify whether the sign-in was you'
  },
  {
    id: 'msg_104', from: 'digest@devweekly.io', to: 'me', subject: 'Dev Weekly #412: agents, agents, agents',
    date: '2026-10-01', snippet: 'This week: how teams are wiring tool-calling agents into CI...',
    requiresAction: false, why: ''
  },
  {
    id: 'msg_105', from: 'noreply@cloudhost.io', to: 'me', subject: 'Your receipt — CloudHost September',
    date: '2026-09-30', snippet: 'Thanks! Your payment of $24.00 was processed...',
    requiresAction: false, why: ''
  }
];

const DEMO_PAGE = {
  url: 'https://example.com',
  title: 'Example Domain',
  text: 'Example Domain. This domain is for use in illustrative examples in documents. ' +
    'You may use this domain in literature without prior coordination or asking for permission. ' +
    'More information can be found at the IANA website (iana.org/domains/example). ' +
    'Typical sections of such a page: a short intro paragraph, a link to further documentation, ' +
    'and minimal styling. (Simulated page content for the Agent Lab browser demo.)'
};

function gmailServer() {
  const tools = [
    { name: 'gmail_search', description: 'Searches Gmail messages. Returns matching message metadata.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'integer' } }, required: ['query'] } },
    { name: 'gmail_get_message', description: 'Retrieves the full content of one message by id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    { name: 'gmail_get_thread', description: 'Retrieves all messages in a thread.', inputSchema: { type: 'object', properties: { threadId: { type: 'string' } }, required: ['threadId'] } },
    { name: 'gmail_list_labels', description: 'Lists Gmail labels.', inputSchema: { type: 'object', properties: {} } },
    { name: 'gmail_create_draft', description: 'Creates an email draft (does not send).', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
    { name: 'gmail_send_message', description: 'SENDS an email immediately. Requires human approval.', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] }, risk: 'high', requiresApproval: true },
    { name: 'gmail_archive_message', description: 'Archives a message (removes from inbox).', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, risk: 'high', requiresApproval: true }
  ];
  return {
    simulated: true,
    async connect() { await delay(250); return { name: 'gmail-mcp-demo', version: '1.0.0-simulated' }; },
    async listTools() { await delay(200); return tools; },
    async disconnect() {},
    async callTool(name, args) {
      await delay(350 + Math.random() * 300);
      switch (name) {
        case 'gmail_search': {
          const q = String(args.query || '').toLowerCase();
          const msgs = DEMO_EMAILS.filter((m) =>
            !q || q.includes('unread') || q.includes('newer_than') ||
            m.subject.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q)
          ).slice(0, args.maxResults || 10);
          return { messages: msgs, count: msgs.length, query: args.query, _simulated: true };
        }
        case 'gmail_get_message': {
          const m = DEMO_EMAILS.find((x) => x.id === args.id);
          if (!m) throw new Error(`No message with id "${args.id}" in the demo inbox.`);
          return { ...m, body: `${m.snippet}\n\n(Full simulated body.)`, _simulated: true };
        }
        case 'gmail_get_thread':
          return { threadId: args.threadId, messages: DEMO_EMAILS.slice(0, 2), _simulated: true };
        case 'gmail_list_labels':
          return { labels: ['INBOX', 'STARRED', 'SENT', 'DRAFTS', 'IMPORTANT'], _simulated: true };
        case 'gmail_create_draft':
          return { draftId: `draft_${Date.now()}`, to: args.to, subject: args.subject, status: 'draft_created', _simulated: true };
        case 'gmail_send_message':
          return { messageId: `sent_${Date.now()}`, to: args.to, subject: args.subject, status: 'sent (simulated — no real email left this browser)', _simulated: true };
        case 'gmail_archive_message':
          return { id: args.id, status: 'archived (simulated)', _simulated: true };
        default: throw new Error(`Unknown demo Gmail tool "${name}".`);
      }
    }
  };
}

function chromeServer() {
  const tools = [
    { name: 'browser_navigate', description: 'Navigates the browser to a URL.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'browser_read_page', description: 'Extracts the readable text content of the current page.', inputSchema: { type: 'object', properties: { maxChars: { type: 'integer' } } } },
    { name: 'browser_get_tabs', description: 'Lists open browser tabs.', inputSchema: { type: 'object', properties: {} } },
    { name: 'browser_click', description: 'Clicks an element by selector.', inputSchema: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } },
    { name: 'browser_screenshot', description: 'Captures a screenshot of the current page.', inputSchema: { type: 'object', properties: {} } },
    { name: 'browser_go_back', description: 'Navigates back in history.', inputSchema: { type: 'object', properties: {} } },
    { name: 'browser_reload', description: 'Reloads the current page.', inputSchema: { type: 'object', properties: {} } }
  ];
  let currentUrl = DEMO_PAGE.url;
  return {
    simulated: true,
    async connect() { await delay(250); return { name: 'chrome-mcp-demo', version: '1.0.0-simulated' }; },
    async listTools() { await delay(200); return tools; },
    async disconnect() {},
    async callTool(name, args) {
      await delay(400 + Math.random() * 400);
      switch (name) {
        case 'browser_navigate': {
          currentUrl = args.url || currentUrl;
          return { url: currentUrl, title: currentUrl.includes('example.com') ? DEMO_PAGE.title : 'Demo Page', status: 'loaded', loadTimeMs: 412, _simulated: true };
        }
        case 'browser_read_page':
          return { url: currentUrl, title: DEMO_PAGE.title, text: DEMO_PAGE.text.slice(0, args.maxChars || 4000), _simulated: true };
        case 'browser_get_tabs':
          return { tabs: [{ id: 1, title: DEMO_PAGE.title, url: currentUrl, active: true }], _simulated: true };
        case 'browser_click':
          return { selector: args.selector, status: 'clicked (simulated)', _simulated: true };
        case 'browser_screenshot':
          return { status: 'screenshot captured (simulated — no image in demo mode)', format: 'png', _simulated: true };
        case 'browser_go_back':
          return { status: 'went back (simulated)', _simulated: true };
        case 'browser_reload':
          return { url: currentUrl, status: 'reloaded (simulated)', _simulated: true };
        default: throw new Error(`Unknown demo browser tool "${name}".`);
      }
    }
  };
}

export function createDemoMcpServer(kind) {
  if (kind === 'gmail') return gmailServer();
  if (kind === 'chrome') return chromeServer();
  throw new Error(`Unknown demo server kind "${kind}".`);
}
