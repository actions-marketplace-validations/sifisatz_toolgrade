# ADR-001: Web platform stack

Status: accepted, 2026-11-16

## Context

ToolGrade needs a SaaS surface for the pitch and the hosted tier: an ingestion API the CLI
uploads run reports to (per-project API keys), multi-tenant orgs and projects, run history with
trend charts, a run detail page with a trajectory viewer, a run-vs-run regression view, project
settings with API keys and a CI snippet, and a landing page. It must look Linear/Vercel grade,
run locally with zero infrastructure, have a credible path to production, and reuse the
TypeScript engine (types, statistics, comparison) rather than reimplement it.

## What comparable products run (researched 2026-11-16)

| Product | Frontend | Data |
|---|---|---|
| Langfuse | Next.js 16 + React 19, tRPC | Postgres + ClickHouse + Redis + S3 |
| Helicone | Next.js | Postgres (Supabase) + ClickHouse |
| Laminar | Next.js 15 + Drizzle | Postgres + ClickHouse |
| promptfoo | React (Vite) SPA | SQLite + Drizzle |
| Arize Phoenix | React 19 Vite SPA, Python API | SQLite / Postgres |
| Opik | React, Java API | ClickHouse + MySQL |

Every one is React/Next.js on a relational store; ClickHouse arrives only at high trace volume.
Run reports are kilobytes, a few per CI build - Postgres is ample for years.

## Options considered

| Option | Verdict |
|---|---|
| **Next.js 16 (App Router)** | **Chosen.** Mature, the category default, Route Handlers for ingestion, server components read the DB directly, imports the engine package, best UI ecosystem. Cost: caching/RSC complexity - we keep pages dynamic and avoid `use cache` in the PoC. |
| TanStack Start 1.x | Strong types, lighter - but 1.0 is five weeks old; thinner ecosystem. Revisit later; UI layer would port as-is. |
| React Router v8 framework | Solid loaders/actions; smaller ecosystem than Next for SaaS scaffolding. |
| SvelteKit 3 | Breaking 3.0 six weeks ago; cannot reuse React UI ecosystem. |
| Rails 8 / Phoenix LiveView / Laravel | Productive for CRUD, but cannot import the TS engine - statistics would be reimplemented in a second language. Rejected. |

## Decision

- **Next.js 16**, App Router, TypeScript, in a **pnpm workspace** with the CLI (`toolgrade`
  package exposes a browser-safe `toolgrade/core` entry: statistics, comparison, report types).
- **Postgres via Drizzle ORM.** Demo/dev runs **PGlite** (Postgres compiled to WASM, embedded,
  file-backed) - no Docker. Production uses hosted Postgres (Neon / Supabase / RDS) through a
  `DATABASE_URL` driver switch; same schema, same SQL dialect. PGlite is single-connection and
  self-described alpha: demo only.
- **Tailwind CSS v4 + shadcn/ui** (Base UI primitives) for components; **Recharts 3** for charts
  (shadcn's chart layer uses it). Tremor rejected: unmaintained since 2025.
- Chart colors and marks follow a validated, colorblind-checked palette (with-tools = blue,
  baseline = orange; status colors reserved for gate state, always with icon + label).
- **Auth:** PoC ships a clearly labelled demo workspace with no login. Project API keys for
  ingestion are real: random, shown once, stored as SHA-256 hashes. Production auth: Better Auth
  (TS-native, org plugin, actively maintained; Auth.js is in maintenance mode). WorkOS when
  enterprise SSO is needed.
- Multi-tenancy from day one: every project belongs to an org, every query is org-scoped.

## Consequences

- One language end to end; the dashboard's numbers come from the same code as the CLI's gate.
- The demo starts with `pnpm dev` and nothing else installed.
- Switching to hosted Postgres must be tested before any production use (driver switch only).
