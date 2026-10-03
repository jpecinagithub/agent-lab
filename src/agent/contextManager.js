// ContextManager: builds exactly what the model sees, in labeled sections.
// The Context Inspector page renders these same sections, so students can
// verify that what they see is what the model gets.
import { estimateTokens } from '../utils/tokens.js';

export const SECTION_NAMES = ['SYSTEM', 'SKILLS', 'MEMORY', 'CONVERSATION', 'AVAILABLE_TOOLS', 'CURRENT_OBJECTIVE', 'CURRENT_PLAN', 'OBSERVATIONS'];

export function buildContext({ systemPrompt, skillText, memory, shortTerm, tools, limits }) {
  const maxChars = limits?.maxContextSize || 60000;
  const sections = [];

  const push = (name, text) => {
    sections.push({ name, text: text || '', chars: (text || '').length, tokens: estimateTokens(text) });
  };

  push('SYSTEM', systemPrompt || '');
  push('SKILLS', skillText || '(no active skill)');
  push('MEMORY', memory?.buildMemoryText(shortTerm?.objective || '') || '(memory empty)');

  const convText = (shortTerm?.conversation || [])
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n') || '(no conversation yet)';
  push('CONVERSATION', convText);

  const toolsText = (tools || [])
    .map((t) => `- ${t.name}${String(t.source || '').startsWith('mcp:') ? ' [MCP]' : ''}: ${t.description || ''}\n  parameters: ${JSON.stringify(t.parameters?.properties || {})}`)
    .join('\n') || '(no tools registered)';
  push('AVAILABLE_TOOLS', toolsText);

  push('CURRENT_OBJECTIVE', shortTerm?.objective || '(not set yet)');
  push('CURRENT_PLAN', (shortTerm?.plan || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(no plan yet)');

  // Observations can grow unboundedly: trim oldest first, always keep newest.
  let observations = [...(shortTerm?.observations || [])];
  let trimmed = 0;
  const obsTextFor = (list) => list.map((o, i) =>
    `[observation ${i + 1}] tool=${o.tool} success=${o.success}${o.simulated ? ' (SIMULATED)' : ''}\nsummary: ${o.summary}` +
    (o.data ? `\ndata: ${JSON.stringify(o.data).slice(0, 1500)}` : '') +
    (o.error ? `\nerror: ${o.error}` : '')
  ).join('\n\n');

  const fixedChars = sections.reduce((n, s) => n + s.chars, 0);
  let obsText = obsTextFor(observations);
  while (observations.length > 2 && fixedChars + obsText.length > maxChars) {
    observations = observations.slice(1);
    trimmed++;
    obsText = obsTextFor(observations);
  }
  if (trimmed > 0) obsText = `[Note: ${trimmed} older observation(s) were trimmed to fit the context window.]\n\n` + obsText;
  push('OBSERVATIONS', obsText || '(no observations yet)');

  const totalChars = sections.reduce((n, s) => n + s.chars, 0);
  const totalTokens = sections.reduce((n, s) => n + s.tokens, 0);

  return {
    sections,
    totalChars,
    totalTokens,
    trimmedObservations: trimmed,
    // Convenience fields for adapters:
    system: systemPrompt || '',
    skillsText: skillText || '',
    memoryText: memory?.buildMemoryText(shortTerm?.objective || '') || '',
    conversation: shortTerm?.conversation || [],
    objective: shortTerm?.objective || null,
    plan: shortTerm?.plan || [],
    observations: shortTerm?.observations || [],
    userRequest: shortTerm?.userRequest || ''
  };
}
