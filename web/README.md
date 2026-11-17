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
- Owners/admins invite by email from the Members page (Better Auth's organization plugin owns
  the invitation, acceptance and membership-limit rules). There is no outbound email yet, so the
  inviter gets a shareable `/accept-invite/<id>` link back instead; accepting it still requires a
  session whose email matches the invite exactly. A brand-new invitee who doesn't have an account
  is routed through sign-up and back to the invite (not the normal onboarding flow) via `next`.
- Project deletion (owner/admin, from the project's Settings page) and org deletion (owner only,
  from the org's Settings page) both require typing the project's/org's slug to confirm, checked
  server-side too. The database cascade (`onDelete: "cascade"` from projects/api_keys/runs/
  subscriptions up to organization) does the actual cleanup; the action's own job is cancelling any
  live Stripe subscription first, in `lib/billing.ts`'s `cancelSubscriptionsFor` - once the row is
  gone there is no record of which subscription was ever its own.

## Deployment

| What | Where | How it updates |
|---|---|---|
| Dashboard + API | https://toolgrade.vercel.app (Vercel project `toolgrade`, root directory `web`) | Every push to `main` deploys to production; other branches get preview URLs |
| Database | Neon Postgres via the Vercel integration (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`) | Migrations run in the build (`pnpm db:migrate`) before `next build` |
| Marketing site | https://sifisatz.github.io/toolgrade/ | `.github/workflows/pages.yml` on every push to `main` |

Re-seed the hosted demo (resets only the demo user and the `acme` org):

```bash
vercel env pull --environment=production web/.data/prod/vercel-production.env
cd web && set -a && . .data/prod/vercel-production.env && . .data/prod/prod.env && set +a
SEED_OUT_DIR=.data/prod pnpm seed
```

`web/.data/prod/prod.env` holds the production `BETTER_AUTH_SECRET` and `DEMO_PASSWORD`
(mode 600, git-ignored); the same values are stored as sensitive variables in Vercel.

## Production environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Hosted Postgres (pooled); `DATABASE_URL_UNPOOLED` is used for migrations, which run in the build |
| `BETTER_AUTH_SECRET` | 32+ random bytes; rotate with `BETTER_AUTH_SECRETS` |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://app.toolgrade.dev` |
| `DEMO_PASSWORD` | Optional: enables "Explore the demo workspace"; omit to disable it |
| `CRON_SECRET` | Authorizes the daily retention-cleanup cron (`vercel.json`'s `crons`) - Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when this is set. Unset, that endpoint refuses every request rather than silently skipping auth |
| `STRIPE_SECRET_KEY` | Stripe API key. Required only once billing is wired up to a real Stripe account - unset, every Stripe-touching code path throws instead of silently no-opping |
| `STRIPE_WEBHOOK_SECRET` | From the Stripe webhook endpoint pointed at `/api/stripe/webhook` |
| `STRIPE_PRICE_EARLY_ACCESS`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_GROWTH` | Stripe Price ids for the three paid plans (see `lib/plans.ts`) |

## Operations

- **Logging**: every API route and the retention cron log structured JSON lines through
  `lib/logger.ts` (`logInfo`/`logWarn`/`logError`) - one line per event, with a `requestId` to
  correlate every line from one request, `orgId`/`projectId`/`runId` where known, and a
  `category`. Better Auth's own internal logging is routed through the same logger. Known-
  sensitive field names (`password`, `token`, `apiKey`, `authorization`, ...) are redacted
  automatically; this only catches values passed as a *field*, never ones baked into a message
  string, which is why call sites never do that. On Vercel these lines land in the project's own
  Logs tab - no separate log aggregation service is wired up (see "not done" below).
- **Health check**: `GET /api/health` runs a trivial query against the database and reports
  `{status: "ok", database: "ok"}` (200) or `{status: "degraded", database: "error"}` (503) -
  nothing about the connection string, driver, or stack trace. Point an uptime monitor at it.
- **Backups**: this project does not run its own backup job. Production Postgres is Neon via the
  Vercel integration, which takes continuous backups with point-in-time recovery on its own -
  restoring a specific point in time is done from the Neon dashboard/CLI (or `vercel env` +
  Neon's branching feature to restore into a new branch, verify, then promote it), not from
  anything in this repo. PGlite (local/demo) has no backups; it is explicitly disposable.
- **Migrations**: run once per deploy, in the Vercel build (`pnpm db:migrate`), never on request
  (see `DB_MIGRATE_ON_CONNECT` in `src/db/client.ts` for the one exception: local/demo only).
  There is no automated rollback for a bad migration - fix forward with a new migration, or in a
  genuine emergency restore the database to a pre-migration point via Neon (above) and redeploy
  the previous commit. Never run a destructive migration (a column/table drop) without a
  deliberate, reviewed step - `pnpm db:generate` is additive by default; a destructive change
  should be reviewed by hand before it ever reaches `pnpm db:migrate` in production.
- **Rolling back a bad deploy**: redeploy a previous, known-good commit from the Vercel dashboard
  (or `vercel rollback`). This only reverts the application code - if the bad deploy's migration
  already ran and is incompatible with the older code, a code-only rollback is not enough; restore
  the database first (above).
- **Growth metrics**: `lib/analytics.ts`'s `recordEvent` writes the activation/monetization funnel
  (`org_created`, `project_created`, `api_key_created`, `run_ingested`, `checkout_started`,
  `subscription_started`) into the `product_events` table - no third-party analytics vendor, same
  reasoning as the `rate_limit` table. A failed write is logged, never thrown: analytics must not
  break the request that triggered it. Run `pnpm growth:report [days]` against `DATABASE_URL` for a
  plain funnel summary (default: last 30 days).
- **Design partner applications**: the public, unauthenticated `/design-partners` form (rate
  limited per IP via the same `rate_limit` table, plus a honeypot field) writes to the
  `design_partner_applications` table and fires a `design_partner_applied` product event. Triage
  by hand with `pnpm partners:report`; update an applicant's `status` directly in the database as
  they move through the pipeline.
- **Not done, deliberately**: no separate error-tracking service (Sentry or similar) - structured
  logs to Vercel's own Logs tab are the extent of it for now. Revisit once there are real paying
  customers whose incidents justify a few more dollars a month; adding it before that would be
  exactly the kind of recurring infrastructure expense this project's budget explicitly avoids
  (see root `docs/PLAN.md`).

## Not in the PoC

Email verification and password reset (need an email provider), social sign-in, model-drift
alerts, hosted runners.

## Marketing site on GitHub Pages

`.github/workflows/pages.yml` publishes the landing page to https://sifisatz.github.io/toolgrade/
on every push to `main`. It is a static export of this same app built with `MARKETING_EXPORT=1`:
only `*.marketing.tsx` routes are compiled (the root layout and landing page), so the dashboard,
API, proxy and auth - which need a server - are not part of it. Calls to action link to the
GitHub quick start, or into a hosted app once the `APP_URL` repository variable is set.

Build it locally:

```bash
MARKETING_EXPORT=1 NEXT_PUBLIC_STATIC_SITE=1 PAGES_BASE_PATH=/toolgrade pnpm exec next build   # -> out/
```

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
