# ToolGrade platform (web)

The hosted side of ToolGrade: a landing page, a multi-tenant dashboard for run history, and the
ingestion API the CLI uploads run reports to. Stack and rationale: [../docs/ADR-001-web-stack.md](../docs/ADR-001-web-stack.md).

## Run it locally

From the repository root (no Docker, no database to install):

```bash
pnpm install
pnpm build              # builds the engine package the web app imports
cd web
pnpm seed               # demo org "acme": 12 runs produced by the real engine + a simulated agent
pnpm dev                # http://localhost:3100
```

`pnpm seed` resets only the demo org and writes one API key per demo project to
`web/.data/demo-api-keys.txt` (git-ignored, mode 600). Upload a real run with it:

```bash
export TOOLGRADE_API_KEY=$(grep '^notes-mcp-local=' web/.data/demo-api-keys.txt | cut -d= -f2-)
node dist/cli.js run examples/notes-suite.yaml --provider openai --model qwen3:8b --upload http://localhost:3100
node dist/cli.js upload .toolgrade/runs/latest.json --url http://localhost:3100 --message "my label"
```

## What is where

| Path | What |
|---|---|
| `src/app/page.tsx` | Landing page (static) |
| `src/app/app/[org]/...` | Dashboard: org overview, project (KPIs, trend charts, runs), run detail with trial viewer, compare, settings & CI |
| `src/app/api/v1/runs/route.ts` | `POST` ingestion: `Authorization: Bearer tg_...`, zod-validated v1 report, 5 MB cap |
| `src/db/` | Drizzle schema and client: PGlite in `.data/pglite` locally, hosted Postgres when `DATABASE_URL` is set |
| `drizzle/` | SQL migrations, applied automatically on first connection |
| `src/lib/data.ts` | All reads; request-time (`connection()`) and org-scoped |
| `scripts/seed.ts` | Demo data generator |

## Conventions

- Next.js 16 with Cache Components: every data read calls `connection()` and renders inside
  `<Suspense>`, so pages ship an instant static shell and stream data.
- Charts use a colour-blind-validated pair: with tools `--chart-1` (blue), no-tool baseline
  `--chart-2` (orange). Status colours (`--status-*`) are reserved for gate state and always come
  with an icon and a label.
- Statistics are never recomputed here: the comparison view calls `compareRuns` from
  `toolgrade/core`, the same code the CLI gate uses.

## Not in the PoC

User sign-in (planned: Better Auth with the organization plugin), billing, model-drift alerts,
hosted runners. The demo workspace is labelled as such throughout the UI.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
