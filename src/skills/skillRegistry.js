// Skills: reusable guidance injected into the model context.
// A skill is NOT code — it is expertise text the harness adds to the prompt so
// the model reasons like a specialist. Only one skill is active at a time.
import { storeGet, storeSet } from '../utils/storage.js';

const ACTIVE_KEY = 'activeSkill';

export const BUILTIN_SKILLS = [
  {
    id: 'general_assistant',
    name: 'General Assistant',
    description: 'Balanced default behavior for everyday tasks.',
    guidance:
      `You are a helpful general-purpose assistant. Prefer the simplest path that fully ` +
      `satisfies the objective. Use tools when they add real value (fresh data, computation, ` +
      `memory); answer directly when the request needs no tools. Be concise and concrete.`
  },
  {
    id: 'email_analyst',
    name: 'Email Analyst',
    description: 'Triages inboxes: importance, actionability, summaries.',
    guidance:
      `You are an email triage specialist. When inspecting messages: 1) separate messages ` +
      `that require action from FYI noise, 2) for each actionable message state WHO it is from, ` +
      `WHAT is needed, and WHY it matters, 3) flag anything time-sensitive (deadlines, invoices, ` +
      `meeting confirmations). Never draft or send replies unless the user explicitly asked.`
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Structured web research with sourced findings.',
    guidance:
      `You are a research specialist. Break the topic into sub-questions, gather evidence with ` +
      `browser/fetch tools, and synthesize. Distinguish FACTS you observed from INFERENCE. ` +
      `If a source failed to load, say so instead of guessing. End with a short sourced summary.`
  },
  {
    id: 'browser_research',
    name: 'Browser Operator',
    description: 'Step-by-step web navigation via browser tools.',
    guidance:
      `You operate a web browser through tools. Always navigate first, then read. If a page ` +
      `fails to load, try once more or report the failure — never invent page content. ` +
      `Summarize what you actually observed on the page, quoting key facts.`
  },
  {
    id: 'finance_analyst',
    name: 'Finance Analyst',
    description: 'Careful with numbers: shows workings, cites figures.',
    guidance:
      `You are a finance analyst. Show your workings for every calculation (use the calculator ` +
      `tool — never do arithmetic in your head when precision matters). State assumptions ` +
      `explicitly, cite the figures you used, and round sensibly for presentation while keeping ` +
      `full precision internally.`
  }
];

export class SkillRegistry {
  constructor() {
    this.skills = new Map(BUILTIN_SKILLS.map((s) => [s.id, s]));
    this.activeId = storeGet(ACTIVE_KEY, 'general_assistant');
    if (!this.skills.has(this.activeId)) this.activeId = 'general_assistant';
  }
  list() { return [...this.skills.values()]; }
  get(id) { return this.skills.get(id) || null; }
  getActive() { return this.get(this.activeId); }
  setActive(id) {
    if (!this.skills.has(id)) return false;
    this.activeId = id;
    storeSet(ACTIVE_KEY, id);
    return true;
  }
  // The exact text injected into the model context.
  injectText() {
    const s = this.getActive();
    return s ? `[Skill: ${s.name}]\n${s.guidance}` : '';
  }
}
