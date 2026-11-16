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

`pnpm seed` resets only the demo user and the demo org. On first run it also writes
`web/.env.local` with a random `BETTER_AUTH_SECRET` (restart `pnpm dev` after the first seed so
Next picks it up). Everything secret it creates is git-ignored and mode 600:

| File | Contents |
|---|---|
| `.env.local` | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| `.data/demo-credentials.json` | password of `demo@toolgrade.dev`, used by "Explore the demo workspace" |
| `.data/demo-api-keys.txt` | one API key per demo project |

Open http://localhost:3100, then either **Start free** (sign up, name a workspace and a first
project, land on "Connect CI") or **Explore the demo workspace** on the sign-in page.

Upload a real run into the demo with its key:

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
| `src/lib/data.ts` | All reads; request-time (`connection()`) and scoped through the user's `member` row |
| `src/lib/auth.ts`, `src/lib/session.ts` | Better Auth (email + password, organization plugin, uuid ids); `requireUser()` |
| `src/proxy.ts` | Cookie-presence redirect to `/sign-in` for `/app/*` and `/onboarding` (optimisation only) |
| `src/app/(auth)/`, `src/app/onboarding/` | Sign-in, sign-up, one-click demo sign-in, first-workspace setup |
| `src/app/app/route.ts` | `/app`: first workspace, onboarding, or sign-in |
| `scripts/seed.ts` | Demo data generator |

## Conventions

- Next.js 16 with Cache Components: every data read calls `connection()` and renders inside
  `<Suspense>`, so pages ship an instant static shell and stream data.
- Charts use a colour-blind-validated pair: with tools `--chart-1` (blue), no-tool baseline
  `--chart-2` (orange). Status colours (`--status-*`) are reserved for gate state and always come
  with an icon and a label.
- Statistics are never recomputed here: the comparison view calls `compareRuns` from
  `toolgrade/core`, the same code the CLI gate uses.

## Access control

- Better Auth owns users, sessions (HttpOnly cookie, 7 days) and passwords (scrypt, minimum 10
  characters). Its organization plugin owns orgs, members and roles; projects belong to an org.
- Three layers: `proxy.ts` redirects requests with no session cookie; every page calls
  `requireUser()` and reads only through membership-joined queries, so a non-member gets the
  same 404 as a missing org; every server action re-checks the session and requires the
  `owner` or `admin` role to create or revoke API keys.
- CLI uploads authenticate with project API keys, not user sessions.

## Production environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Hosted Postgres; migrations apply on first connection |
| `BETTER_AUTH_SECRET` | 32+ random bytes; rotate with `BETTER_AUTH_SECRETS` |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://app.toolgrade.dev` |
| `DEMO_PASSWORD` | Optional: enables "Explore the demo workspace"; omit to disable it |

## Not in the PoC

Email verification and password reset (need an email provider), social sign-in, invitations UI,
billing, model-drift alerts, hosted runners.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
