// MCP adapter: normalizes discovered MCP tool schemas and registers them in
// the SAME Tool Registry as native tools, so Qwen never knows the difference.
export function normalizeMcpSchema(inputSchema) {
  const s = inputSchema && typeof inputSchema === 'object' ? inputSchema : {};
  return {
    type: 'object',
    properties: s.properties || {},
    ...(s.required ? { required: s.required } : {}),
    ...(s.additionalProperties !== undefined ? { additionalProperties: s.additionalProperties } : {})
  };
}

export function mcpToolsToDefs(serverName, mcpTools, callTool, { simulated = false } = {}) {
  return (mcpTools || []).map((t) => ({
    name: t.name,
    description: t.description || `MCP tool from ${serverName}`,
    parameters: normalizeMcpSchema(t.inputSchema),
    handler: async (args) => {
      const result = await callTool(t.name, args);
      // Normalize MCP content blocks into plain data.
      if (result && Array.isArray(result.content)) {
        const texts = result.content.filter((c) => c.type === 'text').map((c) => c.text);
        const structured = result.structuredContent;
        return structured ?? { text: texts.join('\n') };
      }
      return result;
    },
    source: `mcp:${serverName}`,
    enabled: true,
    risk: t.risk || (/send|delete|archive|submit/i.test(t.name) ? 'high' : 'low'),
    requiresApproval: t.requiresApproval ?? (/send|delete|archive/i.test(t.name)),
    category: 'mcp',
    simulated
  }));
}

export function registerMcpTools({ registry, serverName, mcpTools, callTool, simulated }) {
  const defs = mcpToolsToDefs(serverName, mcpTools, callTool, { simulated });
  const registered = defs.map((d) => registry.register(d));
  return registered;
}

export function unregisterMcpTools(registry, serverName) {
  const prefix = `mcp:${serverName}`;
  const removed = [];
  for (const t of registry.list()) {
    if (t.source === prefix) { registry.unregister(t.name); removed.push(t.name); }
  }
  return removed;
}
