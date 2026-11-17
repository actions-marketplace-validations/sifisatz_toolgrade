# Security and privacy

What ToolGrade's hosted platform (`web/`) actually does today, for anyone deciding whether to
upload their reports to it. This is a snapshot of the current implementation, not a promise about
features that don't exist yet - see "Known gaps" at the end for what's deliberately not here.

## Tenant isolation

Every read goes through the signed-in user's own membership row - `getOrg`/`getProject` in
[web/src/lib/data.ts](../web/src/lib/data.ts) join `organization`/`projects` through `member` on
the caller's user id, so a non-member gets exactly what a nonexistent org gives: `undefined`. Org
and project existence is never leaked to someone who isn't a member. Every other project-scoped
read (`listRuns`, `getRun`, usage, entitlements, billing) takes a `projectId` that only ever came
out of one of those checked lookups - there is no code path that accepts a bare id from the client
and trusts it.

Server actions re-check this themselves rather than trusting a route having already done it: the
proxy middleware ([web/src/proxy.ts](../web/src/proxy.ts)) only checks for a session *cookie*,
explicitly as a redirect optimisation - every page and action calls `getSession()`, which does a
real database lookup, and every mutation re-resolves the caller's role in that specific org before
doing anything (see `findManagedProject`/`findManagedOrg` in
[web/src/app/app/\[org\]/\[project\]/settings/actions.ts](../web/src/app/app/%5Borg%5D/%5Bproject%5D/settings/actions.ts)).

Covered by tests: `test/auth.test.ts` (membership, forged session cookies), `test/baseline.test.ts`
(an API key can never read another project's runs).

## API keys

- 256 bits of randomness (`tg_` + 32 random bytes, base64url), generated with `node:crypto`.
- Only a SHA-256 hash is stored; the key itself is shown exactly once, at creation.
- Revocation is a timestamp (`revokedAt`), checked on every use; a revoked key is rejected
  immediately, and never un-revoked.
- `lastUsedAt` is updated on every successful call, so a key nobody's touched in months is visible
  in the UI.
- Only an org's owner/admin can create or revoke a project's keys.
- Never logged: request handlers only log the API key's row id, never the token or its hash.

## Report ingestion (`POST /api/v1/runs`)

- Authenticates the API key *before* reading the request body, so an unauthenticated or
  already-rejected (usage limit, rate limit) caller never makes the server buffer an upload.
- Body size is capped at 5 MB, enforced by both the `Content-Length` header and a streaming byte
  count (a caller cannot lie about the header and still get the server to buffer an unbounded
  body).
- The uploaded report is fully validated against a versioned Zod schema
  ([web/src/lib/ingest.ts](../web/src/lib/ingest.ts)) with explicit bounds on every array and
  string field - nothing reaches the database on the strength of "it parsed as JSON" alone.
- NUL bytes are rejected outright (Postgres text/jsonb cannot store them, and rejecting is safer
  than silently stripping).
- Rate-limited per API key: 30 uploads/minute for ingestion, 60 requests/minute for baseline
  fetches ([web/src/lib/rate-limit.ts](../web/src/lib/rate-limit.ts)) - generous enough for
  parallel CI matrices, not for scripted abuse of a leaked key.
- Usage-limited per project's plan (see [docs/PLAN.md](PLAN.md) and
  [web/src/lib/usage.ts](../web/src/lib/usage.ts)): a project over its monthly allowance gets a
  clear `402` with the actual numbers and a link to upgrade, never a silently discarded upload.

## Authentication

- Sessions are validated against the database on every request that matters (`getSession()`), not
  just trusted from the cookie's presence.
- Passwords: 10-character minimum, hashed by Better Auth (scrypt), never logged or returned.
- Rate limiting: Better Auth's own built-in limiter, backed by the same Postgres database (no
  extra infrastructure), with stricter custom limits on `/sign-in/email` and `/sign-up/email` (5
  per minute) than the general default (20 per minute). Deliberately left at Better Auth's own
  default of "enabled in production only" - the local dev loop and the test suite call these
  endpoints many times in quick succession, and should not be at the mercy of a limiter meant for
  real attack traffic.
- CSRF: Next.js's own Server Actions same-origin check (Origin header must match the
  deployment's own host) is active with no extra configuration, and Better Auth's own API is
  scoped to `BETTER_AUTH_URL` with no wildcard CORS origin. Neither needed a custom
  `trustedOrigins`/`allowedOrigins` override for the current deployment shape.
- Cookies: httpOnly always, `secure` automatically whenever `BETTER_AUTH_URL` is `https://`
  (i.e. in any real deployment), `sameSite=lax` - all Better Auth defaults, not overridden.
- Account deletion is enabled (no email provider to send a confirmation through, so it is
  immediate), but refuses to go through if it would orphan an organization: a user who is the
  *sole* owner of one or more orgs cannot delete their account until they transfer ownership or
  delete those orgs first (`soleOwnerOrgs` in [web/src/lib/auth.ts](../web/src/lib/auth.ts)).
- Organization membership management (remove a member, change a role, leave an org) is wired to
  Better Auth's organization plugin, which enforces owner/admin-only and refuses to remove or
  demote an org's last owner - see
  [web/src/app/app/\[org\]/actions.ts](../web/src/app/app/%5Borg%5D/actions.ts). There is not yet
  a dedicated UI page for this (no "Members" tab exists); the actions themselves are complete and
  tested.

## Data retention and deletion

Plan-based retention (90 days / 365 days / local-only on the free plan) and its scheduled cleanup
are documented in the commit history for TG-015 and implemented in
[web/src/lib/retention.ts](../web/src/lib/retention.ts). A canceled subscription's existing run
history is never purged automatically - only a concrete, current retention window ever deletes
data.

There is no separate backup-deletion policy document yet: this project does not manage its own
database backups (that is the hosting provider's responsibility, e.g. Neon's own backup/retention
settings), so "deleting a run" here means deleting it from the live database, not necessarily from
a point-in-time backup snapshot that already existed before the delete.

## Privacy

- Evaluation reports can contain prompts, tool arguments, tool outputs and anything your MCP
  server or test fixtures return - ToolGrade does not redact any of this. If your suite's fixtures
  or tasks involve real customer data or secrets, treat the uploaded report the same way you'd
  treat a log file that could contain the same thing, and prefer synthetic fixtures for anything
  you plan to upload to a hosted project.
- Customer-side execution (the CLI, run locally or in your own CI) keeps your model provider
  credentials with you - they are never sent to ToolGrade's platform. Only the report itself is
  uploaded, and only when you pass `--upload`/`--baseline`/`toolgrade upload`.
- No analytics or telemetry are wired into the hosted platform today - nothing is sent anywhere
  beyond what you explicitly upload.
- No customer report content is used for model training; there is no mechanism in this codebase
  that could do so even inadvertently (reports are stored, displayed, and compared - never sent to
  a model-training pipeline of any kind).

## Known gaps (deliberately not done yet)

- **Email verification and password reset**: both need an email provider, which this project does
  not have configured. Implementing a half-working version (e.g. verification required but no way
  to ever receive the email) would be worse than the current state of not requiring it.
- **Two-factor authentication**: not implemented; would be a reasonable addition once there are
  real paying customers whose accounts are worth a second factor.
- **Structured operational logging** (API/ingest/webhook/cron requests, correlated by a
  `requestId`) is implemented - see [web/README.md](../web/README.md)'s Operations section. A
  separate, persisted **security audit trail** (e.g. "user X removed member Y at time T," queryable
  after the fact, independent of whatever log retention Vercel's own dashboard happens to keep) is
  not - today that history only exists as log lines, not as rows in the database.
