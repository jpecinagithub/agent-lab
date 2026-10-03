// MCP server registry: persisted configs + live client instances.
// Ships with two predefined DEMO servers (Gmail, Chrome) that run in-process.
import { storeGet, storeSet } from '../utils/storage.js';
import { uid } from '../utils/id.js';
import { McpClient } from './mcpClient.js';
import { createDemoMcpServer, DEMO_SERVER_DEFS } from './demoServers.js';

const KEY = 'mcpServers';

function seedServers() {
  const existing = storeGet(KEY, null);
  if (existing) return existing;
  const seed = DEMO_SERVER_DEFS.map((d) => ({
    id: d.id, name: d.name, endpoint: d.endpoint, transport: 'demo',
    authType: 'none', demo: true, demoKind: d.kind, enabled: true, createdAt: Date.now()
  }));
  storeSet(KEY, seed);
  return seed;
}

export class McpRegistry {
  constructor() {
    this.servers = seedServers();
    this.clients = new Map(); // id -> McpClient
    this.listeners = new Set();
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) { try { fn(this.list()); } catch { /* noop */ } } }
  persist() { storeSet(KEY, this.servers); }

  list() { return [...this.servers]; }
  get(id) { return this.servers.find((s) => s.id === id) || null; }

  add({ name, endpoint, transport = 'http', authType = 'none', authToken = '' }) {
    const server = {
      id: uid('mcp'), name: String(name || 'MCP Server').slice(0, 60),
      endpoint, transport, authType, authToken: authType === 'bearer' ? authToken : '',
      demo: false, enabled: true, createdAt: Date.now()
    };
    this.servers.push(server);
    this.persist(); this.emit();
    return server;
  }
  remove(id) {
    this.disconnect(id).catch(() => {});
    this.servers = this.servers.filter((s) => s.id !== id);
    this.persist(); this.emit();
  }

  getClient(id) {
    const server = this.get(id);
    if (!server) return null;
    if (!this.clients.has(id)) {
      const demoImpl = server.demo ? createDemoMcpServer(server.demoKind) : null;
      this.clients.set(id, new McpClient({
        name: server.name,
        endpoint: server.endpoint,
        transport: server.transport,
        authToken: server.authToken || '',
        demoImpl
      }));
    }
    return this.clients.get(id);
  }

  async connect(id) {
    const client = this.getClient(id);
    if (!client) throw new Error('Unknown MCP server.');
    const info = await client.connect();
    this.emit();
    return { client, info };
  }

  async disconnect(id) {
    const client = this.clients.get(id);
    if (client) { try { await client.disconnect(); } catch { /* noop */ } }
    this.emit();
  }

  statusOf(id) {
    return this.clients.get(id)?.status || 'disconnected';
  }
}
