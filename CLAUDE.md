# CLAUDE.md — AI Assistant Rules for QS-WFUI

## ⚠️ CRITICAL SECURITY RULE — READ FIRST

**NEVER read, display, or include the contents of any `.env` file in any response or tool call.**

The `.env` files contain production API keys (OpenAI, Supabase service role, Upstash Redis).
When their contents are sent to an AI API server, automated credential scanners detect and
disable the keys. This has happened TWICE in this project.

Files that must NEVER be read by AI tools:
- `apps/api/.env`
- `apps/web/.env.local`
- Any file matching `.env*` (except `.env.example` files)

If you need to know a config value, ask the user to tell you just that one value in a
temporary message — never paste the whole `.env` file into chat.

---

## Project Overview

**QS-WFUI** — Lados Workflow Platform (monorepo)

```
apps/api/   — NestJS API, port 4000 (/api/v1)
apps/web/   — Next.js frontend, port 3000
packages/
  shared-types/       — ApiResponse<T> and shared DTOs
  execution-engine/   — Workflow runner (NodeContext, SkipNodeSpec)
  node-sdk/           — NodeManifest, NodeHandler interfaces
packs/
  core-pack/          — Built-in nodes (resource.*, event.*, artifact.*)
  contractor-pack/    — Construction/logistics domain nodes
  foundation-pack/    — Cross-domain utility nodes
  document-pack/      — Document generation nodes
  procurement-pack/   — Procurement workflow nodes
```

## Tech Stack

- **API**: NestJS + Supabase (service role for server ops)
- **Web**: Next.js App Router + Supabase SSR (cookie-based auth)
- **Queue**: BullMQ + Upstash Redis
- **AI**: OpenAI GPT-4o (tool-calling, vision)
- **Package manager**: pnpm workspaces

## Current Phase

Phase 15 complete. AI Insights page at `/ai`, workflow trigger via AiCommandBar.

## Key Conventions

- All API responses use `ApiResponse<T>` envelope: `{ success, data, error }`
- `apiClient` does NOT throw on non-2xx — always check `res.success`
- `ValidationPipe` uses `forbidNonWhitelisted: true` — only send DTO-declared fields
- History sent to `/ai/assist` must use `{ role, content }` only — no extra fields
