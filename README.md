# AGENT LAB — AI Agent Harness Laboratory

An educational web application that shows how a real AI-agent **harness** works — not a chatbot:

**User → Harness → LLM → Decision → Tool → Observation → LLM → Final Answer**

100% browser-side. No backend, no database, no agent framework (no LangChain, CrewAI, etc.).

## Run it

```bash
npm install
npm run dev      # development
npm run build    # production build → dist/
npm run preview  # serve the production build
```

## What it demonstrates

- **The harness loop** — explicit state machine: `IDLE → PLANNING → SELECTING_ACTION → EXECUTING_TOOL → OBSERVING → REASONING → COMPLETED/FAILED`, with pause, step, stop and reset.
- **The LLM never executes tools.** The model only proposes actions; the harness validates, permission-checks, executes and returns structured observations.
- **Two reasoning modes** — a transparent simulated brain (no credentials needed, every output labeled `SIMULATED`) and the real `qwen3.8-flash` model via an OpenAI-compatible endpoint (key entered manually, kept in `sessionStorage`).
- **Configured MaaS endpoint** — `https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`.
- **Secure Qwen proxy** — Vite handles `/api/qwen` locally and a Vercel serverless function handles it in production, so `QWEN_API_KEY` is never compiled into the browser bundle.

## Vercel environment variables

Configure these in Project Settings → Environment Variables:

- `QWEN_API_KEY` — required and secret.
- `QWEN_BASE_URL` — `https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`.
- `QWEN_MODEL` — `qwen3.8-flash`.
- `AGENT_LAB_ACCESS_TOKEN` — strongly recommended for public deployments to prevent unauthorized use of your model quota.

Use `.env.example` as the local template. Never commit `.env` or `.env.local`.
- **One normalized tool executor** for native, MCP, API and custom tools: validation, permissions, timeouts, retries, logging.
- **MCP** — connect/discover/call against in-process simulated Gmail and Chrome demo servers (every simulated result labeled `SIMULATED`).
- **Memory** (short-term per run, long-term persisted), **skills** (injectable guidance), **guardrails** (iteration/tool/timeout/context limits), **human approvals** for high-impact actions.
- **Full observability** — clickable execution trace, per-run metrics, local run history.

## Pages

Dashboard · Agent (live harness + demos) · Execution Trace · Architecture · Tools (registry + visual builder) · MCP Servers · Memory · Skills · System Prompt · Observability · History · Settings.

> Educational mode: API keys stored in the browser are suitable for local experimentation but should not be used as a production security architecture.
