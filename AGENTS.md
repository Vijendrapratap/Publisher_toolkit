<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Autonomous Senior Dev & Multi-Agent Executive Protocol

See [GEMINI.md](file:///home/pratap/work/Publisher_toolkit/GEMINI.md) for full architectural specification:
- **CEO (User)**: Defines strategic goals, scope, and high-level requirements.
- **CTO / PM (Lead Orchestrator)**: Refines objectives, decomposes tasks, creates contracts, and coordinates pods.
- **Pods (`invoke_subagent`)**:
  - `designer`: UI/UX layout, typography, tokens, visual craft.
  - `frontend_engineer`: React 19, Next.js App Router, Tailwind CSS, component state.
  - `backend_engineer`: Server Actions, Route Handlers, Prisma, PostgreSQL, Zod.
  - `ml_ai_engineer`: Vercel AI SDK, OpenRouter, prompt engineering, structured streaming.
- **QA Gate (`qa_engineer`)**: Mandatory verification before reporting to CEO (`tsc --noEmit`, `npm test`, `npm run test:e2e`).
