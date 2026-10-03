// MCP client: initialize handshake -> tools/list -> tools/call.
// Real servers speak JSON-RPC over the transport; demo servers implement the
// same interface in-process (and are always labeled SIMULATED).
import { McpTransport } from './transport.js';

export const MCP_PROTOCOL_VERSION = '2024-11-05';

export class McpClient {
  constructor({ name, endpoint, transport = 'http', authToken = '', demoImpl = null }) {
    this.name = name;
    this.endpoint = endpoint;
    this.transportKind = transport;
    this.demoImpl = demoImpl; // when set, all calls go to the in-process demo server
    this.transport = demoImpl ? null : new McpTransport({ endpoint, authToken });
    this.status = 'disconnected';
    this.serverInfo = null;
    this.lastError = null;
    this.tools = [];
  }

  get isDemo() { return Boolean(this.demoImpl); }

  async connect() {
    this.status = 'connecting';
    this.lastError = null;
    try {
      if (this.demoImpl) {
        this.serverInfo = await this.demoImpl.connect();
      } else {
        const result = await this.transport.rpc('initialize', {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'agent-lab', version: '1.0.0' }
        });
        this.serverInfo = result?.serverInfo || { name: this.name };
        // Best-effort initialized notification; failures here are non-fatal.
        try { await this.transport.rpc('notifications/initialized', {}); } catch { /* noop */ }
      }
      this.status = 'connected';
      return this.serverInfo;
    } catch (e) {
      this.status = 'error';
      this.lastError = e.message;
      throw e;
    }
  }

  async discoverTools() {
    if (this.status !== 'connected') throw new Error('MCP server is not connected.');
    const tools = this.demoImpl
      ? await this.demoImpl.listTools()
      : (await this.transport.rpc('tools/list', {})).tools || [];
    this.tools = tools;
    return tools;
  }

  async callTool(name, args = {}) {
    if (this.status !== 'connected') throw new Error(`MCP server "${this.name}" is not connected.`);
    if (this.demoImpl) return this.demoImpl.callTool(name, args);
    const result = await this.transport.rpc('tools/call', { name, arguments: args });
    if (result?.isError) {
      const msg = (result.content || []).map((c) => c.text || '').join(' ') || 'MCP tool reported an error.';
      throw new Error(msg);
    }
    return result;
  }

  async disconnect() {
    try { this.transport?.closeEventStream(); } catch { /* noop */ }
    try { await this.demoImpl?.disconnect(); } catch { /* noop */ }
    this.status = 'disconnected';
    this.serverInfo = null;
    this.tools = [];
  }
}
