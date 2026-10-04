// AgentContext: the single React bridge to the harness runtime.
// Creates all singleton modules, subscribes to runtime events, and exposes
// actions (run/pause/step/stop, approvals, MCP, tools, memory, settings).
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ToolRegistry } from '../tools/registry.js';
import { getBuiltinTools } from '../tools/builtin.js';
import { rehydrateCustomTool, serializeCustomTool } from '../tools/toolFactory.js';
import { MemoryManager } from '../memory/memoryManager.js';
import { SkillRegistry } from '../skills/skillRegistry.js';
import { PermissionManager } from '../security/permissionManager.js';
import { ExecutionLogger } from '../logs/executionLogger.js';
import { McpRegistry } from '../mcp/mcpRegistry.js';
import { registerMcpTools, unregisterMcpTools } from '../mcp/mcpAdapter.js';
import { AgentRuntime } from '../agent/agentRuntime.js';
import { STATE_META } from '../agent/agentState.js';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_GMAIL_CLIENT_ID } from '../config.js';
import { DEFAULT_ENDPOINT, DEFAULT_MODEL } from '../llm/qwenClient.js';
import { getGmailNativeTools } from '../tools/gmailNative.js';
import { connectGmailAccount, clearGmailToken, isGmailConnected } from '../tools/gmailAuth.js';
import { storeGet, storeSet, sessionSet } from '../utils/storage.js';
import { uid } from '../utils/id.js';

const AgentCtx = createContext(null);
export const useAgent = () => useContext(AgentCtx);

const DEFAULT_SETTINGS = {
  llmMode: 'demo',
  qwen: { endpoint: DEFAULT_ENDPOINT, model: DEFAULT_MODEL, temperature: 0.7, maxTokens: 2000 },
  gmail: { clientId: DEFAULT_GMAIL_CLIENT_ID },
  limits: { maxIterations: 10, maxToolCalls: 25, timeoutMs: 180000, toolTimeoutMs: 30000, maxContextSize: 60000 },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  stepMode: false
};

function loadSettings() {
  const saved = storeGet('settings', {});
  const savedQwen = saved.qwen || {};
  // Migrate installations that still carry one of the old preset defaults.
  const legacyPresetModels = new Set(['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-coder-plus', 'qwen-coder-turbo']);
  const model = !savedQwen.model || legacyPresetModels.has(savedQwen.model)
    ? DEFAULT_MODEL
    : savedQwen.model;
  const legacyEndpoints = new Set([
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    'https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com/v1',
    'https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com'
  ]);
  const endpoint = !savedQwen.endpoint || legacyEndpoints.has(savedQwen.endpoint)
    ? DEFAULT_ENDPOINT
    : savedQwen.endpoint;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    qwen: { ...DEFAULT_SETTINGS.qwen, ...savedQwen, endpoint, model },
    gmail: { ...DEFAULT_SETTINGS.gmail, ...(saved.gmail || {}) },
    limits: { ...DEFAULT_SETTINGS.limits, ...(saved.limits || {}) }
  };
}

export const DEMO_PROMPTS = {
  calc: 'Calculate 18% of 2,450 and remember the result.',
  email: 'Check my inbox and tell me which messages require action.',
  browser: 'Open https://example.com and summarize its main page.'
};

export function AgentProvider({ children }) {
  const [view, setView] = useState('dashboard');
  const [settings, setSettings] = useState(loadSettings);
  const [ui, setUi] = useState({ state: 'IDLE', meta: STATE_META.IDLE });
  const [traceVersion, setTraceVersion] = useState(0);
  const [chat, setChat] = useState([]);
  const [notices, setNotices] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [streaming, setStreaming] = useState('');
  const [contextInfo, setContextInfo] = useState(null);
  const [toolsVersion, setToolsVersion] = useState(0);
  const [memVersion, setMemVersion] = useState(0);
  const [mcpVersion, setMcpVersion] = useState(0);
  const [history, setHistory] = useState(() => storeGet('history', []));
  const [runMeta, setRunMeta] = useState(null);
  const [showTutorial, setShowTutorial] = useState(() => !storeGet('tutorialSeen', false));
  const [gmailConnected, setGmailConnected] = useState(false);

  const mods = useRef(null);
  if (!mods.current) {
    const registry = new ToolRegistry();
    const memory = new MemoryManager();
    const skills = new SkillRegistry();
    const permissions = new PermissionManager();
    const logger = new ExecutionLogger();
    const mcpRegistry = new McpRegistry();
    const settingsRef = { current: loadSettings() };
    const runtime = new AgentRuntime({
      registry, memory, skills, permissions, logger,
      getSettings: () => settingsRef.current,
      onRunEnd: (record) => {
        setHistory((h) => {
          const next = [record, ...h].slice(0, 50);
          storeSet('history', next);
          return next;
        });
      }
    });
    mods.current = { registry, memory, skills, permissions, logger, mcpRegistry, runtime, settingsRef };
  }
  const { registry, memory, skills, permissions, logger, mcpRegistry, runtime, settingsRef } = mods.current;
  settingsRef.current = settings;

  const pushNotice = useCallback((kind, text) => {
    const n = { id: uid('notice'), kind, text, ts: Date.now() };
    setNotices((ns) => [...ns.slice(-4), n]);
    setTimeout(() => setNotices((ns) => ns.filter((x) => x.id !== n.id)), 12000);
  }, []);
  const dismissNotice = useCallback((id) => setNotices((ns) => ns.filter((x) => x.id !== id)), []);

  // ---- one-time init: tools, custom tools, demo MCP servers ----
  useEffect(() => {
    for (const t of getBuiltinTools()) {
      try { if (!registry.has(t.name)) registry.register(t); } catch (e) { console.error(e); }
    }
    const custom = storeGet('customTools', []);
    for (const c of custom) {
      try { registry.register(rehydrateCustomTool(c)); } catch (e) { console.error('custom tool rehydrate failed', c.name, e); }
    }
    const unsubs = [
      registry.onChange(() => setToolsVersion((v) => v + 1)),
      memory.onChange(() => setMemVersion((v) => v + 1)),
      mcpRegistry.onChange(() => setMcpVersion((v) => v + 1))
    ];
    // Auto-connect the in-process demo MCP servers so demos work out of the box.
    mods.current.mcpReady = (async () => {
      for (const s of mcpRegistry.list().filter((x) => x.demo)) {
        try {
          const { client } = await mcpRegistry.connect(s.id);
          const tools = await client.discoverTools();
          unregisterMcpTools(registry, s.name);
          registerMcpTools({
            registry, serverName: s.name, mcpTools: tools,
            callTool: (n, a) => client.callTool(n, a),
            simulated: true
          });
        } catch (e) {
          console.error('demo MCP init failed', s.name, e);
        }
      }
    })();
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- runtime event subscriptions ----
  useEffect(() => {
    const bump = () => setTraceVersion((v) => v + 1);
    const subs = [];
    subs.push(runtime.on('state', ({ to, meta }) => {
      setUi((u) => ({ ...u, state: to, meta, agentState: { ...runtime.agentState } }));
      bump();
    }));
    subs.push(runtime.on('run:start', (meta) => {
      setRunMeta(meta); setStreaming(''); setContextInfo(null); bump();
      setUi((u) => ({ ...u, agentState: { ...runtime.agentState } }));
    }));
    subs.push(runtime.on('run:end', () => { setStreaming(''); setPendingApproval(null); bump(); }));
    subs.push(runtime.on('objective', ({ objective, plan }) => {
      setUi((u) => ({ ...u, objective, plan, agentState: { ...runtime.agentState } })); bump();
    }));
    subs.push(runtime.on('action', (a) => {
      setUi((u) => ({ ...u, currentAction: a, currentTool: a.tool, agentState: { ...runtime.agentState } })); bump();
    }));
    subs.push(runtime.on('observation', (o) => {
      setUi((u) => ({ ...u, lastObservation: o, currentTool: null, agentState: { ...runtime.agentState } })); bump();
    }));
    subs.push(runtime.on('iteration', ({ iteration }) => {
      setUi((u) => ({ ...u, iteration, agentState: { ...runtime.agentState } })); bump();
    }));
    subs.push(runtime.on('checkpoint', () => bump()));
    subs.push(runtime.on('stepmode', ({ stepMode }) => {
      setSettings((s) => { const n = { ...s, stepMode }; storeSet('settings', n); return n; });
    }));
    subs.push(runtime.on('chat', (m) => setChat((c) => [...c, m])));
    subs.push(runtime.on('notice', ({ kind, text }) => { pushNotice(kind, text); bump(); }));
    subs.push(runtime.on('token', ({ text }) => setStreaming((s) => s + text)));
    subs.push(runtime.on('context', (info) => setContextInfo(info)));
    subs.push(runtime.on('approval:requested', (a) => { setPendingApproval(a); bump(); }));
    subs.push(runtime.on('approval:resolved', () => setPendingApproval(null)));
    subs.push(runtime.on('reset', () => {
      setUi({ state: 'IDLE', meta: STATE_META.IDLE });
      setStreaming(''); setContextInfo(null); setPendingApproval(null); bump();
    }));
    return () => subs.forEach((u) => u());
  }, [runtime, pushNotice]);

  // ---- actions ----
  const updateSettings = useCallback((patch) => {
    setSettings((s) => {
      const n = { ...s, ...patch, qwen: { ...s.qwen, ...(patch.qwen || {}) }, gmail: { ...s.gmail, ...(patch.gmail || {}) }, limits: { ...s.limits, ...(patch.limits || {}) } };
      storeSet('settings', n);
      return n;
    });
  }, []);

  const setApiKey = useCallback((key) => {
    sessionSet('qwen_key', key || '');
  }, []);

  const sendMessage = useCallback(async (text) => {
    try { await mods.current.mcpReady; } catch { /* demos still work with native tools */ }
    runtime.run(text);
  }, [runtime]);

  const runDemo = useCallback(async (kind) => {
    setView('agent');
    try { await mods.current.mcpReady; } catch { /* demos still work with native tools */ }
    runtime.run(DEMO_PROMPTS[kind]);
  }, [runtime]);

  const clearChat = useCallback(() => {
    setChat([]);
    runtime.sessionConversation = [];
  }, [runtime]);

  // ---- MCP actions ----
  const mcpConnect = useCallback(async (id) => {
    const { client } = await mcpRegistry.connect(id);
    return client;
  }, [mcpRegistry]);

  const mcpDiscover = useCallback(async (id) => {
    const server = mcpRegistry.get(id);
    const client = mcpRegistry.getClient(id);
    if (!server || !client) throw new Error('Unknown MCP server.');
    if (client.status !== 'connected') await mcpRegistry.connect(id);
    const tools = await client.discoverTools();
    unregisterMcpTools(registry, server.name);
    const registered = registerMcpTools({
      registry, serverName: server.name, mcpTools: tools,
      callTool: (n, a) => client.callTool(n, a),
      simulated: client.isDemo
    });
    pushNotice('info', `${tools.length} tool(s) discovered on "${server.name}" and registered${client.isDemo ? ' (SIMULATED)' : ''}.`);
    return { tools, registered };
  }, [mcpRegistry, registry, pushNotice]);

  const mcpDisconnect = useCallback(async (id) => {
    const server = mcpRegistry.get(id);
    if (server) unregisterMcpTools(registry, server.name);
    await mcpRegistry.disconnect(id);
  }, [mcpRegistry, registry]);

  const mcpAdd = useCallback((def) => mcpRegistry.add(def), [mcpRegistry]);
  const mcpRemove = useCallback((id) => mcpRegistry.remove(id), [mcpRegistry]);

  // ---- custom tools ----
  const saveCustomTool = useCallback((tool) => {
    registry.register(tool);
    const all = registry.list().filter((t) => t.source === 'custom').map(serializeCustomTool);
    storeSet('customTools', all);
  }, [registry]);
  const deleteCustomTool = useCallback((name) => {
    registry.unregister(name);
    const all = registry.list().filter((t) => t.source === 'custom').map(serializeCustomTool);
    storeSet('customTools', all);
  }, [registry]);

  const clearHistory = useCallback(() => {
    setHistory([]); storeSet('history', []);
  }, []);
  const deleteRun = useCallback((id) => {
    setHistory((h) => { const n = h.filter((r) => r.id !== id); storeSet('history', n); return n; });
  }, []);

  // ---- native Gmail (real) vs simulated demo tools ----
  // Same tool names, real handlers. Connecting swaps the SIMULATED demo
  // versions out; disconnecting restores them. The harness never notices:
  // it only ever sees tool names in the registry.
  const GMAIL_TOOL_NAMES = ['gmail_search', 'gmail_get_message'];
  const simulatedGmailBackup = useRef({});

  const swapToNativeGmail = useCallback(() => {
    for (const name of GMAIL_TOOL_NAMES) {
      const current = registry.get(name);
      if (current && current.source !== 'native' && !simulatedGmailBackup.current[name]) {
        simulatedGmailBackup.current[name] = current;
      }
      if (current) registry.unregister(name);
    }
    const getClientId = () => settingsRef.current.gmail?.clientId?.trim() || DEFAULT_GMAIL_CLIENT_ID;
    for (const def of getGmailNativeTools({ getClientId })) {
      try { registry.register(def); } catch (e) { console.error('native gmail register failed', e); }
    }
  }, [registry]);

  const swapToSimulatedGmail = useCallback(() => {
    for (const name of GMAIL_TOOL_NAMES) {
      const current = registry.get(name);
      if (current && current.source === 'native') registry.unregister(name);
      const backup = simulatedGmailBackup.current[name];
      if (backup && !registry.has(name)) {
        try { registry.register(backup); } catch (e) { console.error('gmail restore failed', e); }
        delete simulatedGmailBackup.current[name];
      }
    }
  }, [registry]);

  const connectGmail = useCallback(async () => {
    const clientId = (settingsRef.current.gmail?.clientId || '').trim() || DEFAULT_GMAIL_CLIENT_ID;
    await connectGmailAccount(clientId); // throws if the user cancels or it fails
    swapToNativeGmail();
    setGmailConnected(true);
    pushNotice('info', 'Gmail connected. gmail_search and gmail_get_message now read your real inbox (read-only scope).');
  }, [swapToNativeGmail, pushNotice]);

  const disconnectGmail = useCallback(() => {
    clearGmailToken();
    swapToSimulatedGmail();
    setGmailConnected(false);
    pushNotice('info', 'Gmail disconnected. The SIMULATED demo tools are back in the registry.');
  }, [swapToSimulatedGmail, pushNotice]);

  // Restore a Gmail session that survived a page reload (token in sessionStorage).
  useEffect(() => {
    (async () => {
      try { await mods.current.mcpReady; } catch { /* demos still work */ }
      if (isGmailConnected()) {
        swapToNativeGmail();
        setGmailConnected(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissTutorial = useCallback(() => {
    storeSet('tutorialSeen', true);
    setShowTutorial(false);
  }, []);

  const value = useMemo(() => ({
    view, setView,
    settings, updateSettings, setApiKey,
    ui, traceVersion, logger, runtime, registry, memory, skills, permissions, mcpRegistry,
    chat, notices, pushNotice, dismissNotice,
    pendingApproval, streaming, contextInfo, runMeta,
    history, clearHistory, deleteRun,
    toolsVersion, memVersion, mcpVersion,
    sendMessage, runDemo, clearChat,
    mcpConnect, mcpDiscover, mcpDisconnect, mcpAdd, mcpRemove,
    saveCustomTool, deleteCustomTool,
    showTutorial, dismissTutorial,
    gmailConnected, connectGmail, disconnectGmail
  }), [view, settings, updateSettings, setApiKey, ui, traceVersion, logger, runtime, registry, memory, skills, permissions, mcpRegistry, chat, notices, pushNotice, dismissNotice, pendingApproval, streaming, contextInfo, runMeta, history, clearHistory, deleteRun, toolsVersion, memVersion, mcpVersion, sendMessage, runDemo, clearChat, mcpConnect, mcpDiscover, mcpDisconnect, mcpAdd, mcpRemove, saveCustomTool, deleteCustomTool, showTutorial, dismissTutorial, gmailConnected, connectGmail, disconnectGmail]);

  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}
