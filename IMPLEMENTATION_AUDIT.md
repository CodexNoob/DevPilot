# DevPilot Implementation Audit

**Audit date:** 2026-11-09  
**Scope:** Read-only repository inspection plus the existing typecheck, lint, and Vitest suite. No application implementation was changed as part of this audit.  
**Review pass (same day):** a second reviewer re-checked these findings, ran the production build, read the hosted dev database (read-only), scanned for secrets, and added the items marked "found in review".

## Executive summary

DevPilot is a working SaaS foundation with Supabase authentication, multi-tenant workspaces, clients/projects, test authoring, an AI test draft flow, a Postgres-backed run queue, a separate Playwright worker, scheduled runs, result history, screenshots, dashboard metrics, and flaky-test reporting. The web app and worker are separated and the browser worker has meaningful SSRF defenses.

The repository is not yet the complete product in the supplied blueprint. Important gaps include password recovery and profile settings, project environments/secrets, fuller workspace roles, test case versioning and duplication, worker leases/heartbeats/retries and active-run cancellation, AI failure analysis, usable issue management, uptime monitoring, integrations, notifications/activity logs, and production deployment. The README still describes an earlier roadmap and should be corrected.

## Verification performed

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript / Next route type generation | Pass | `npm.cmd run typecheck` completed (`next typegen && tsc --noEmit`). |
| ESLint | Pass | `npm.cmd run lint` completed without reported issues. |
| Vitest | Pass | 14 test files, 185 tests passed. Includes PGlite migration/RLS coverage and worker network-guard tests. |
| Build | Pass | `npm run build` (review pass): compiled, 25/25 routes generated with Cache Components / Partial Prerendering. |
| Hosted Supabase schema | Pass | `supabase migration list` against the development project: all 3 local migrations applied remotely. Read-only queries confirmed one workspace per user, no projects without a workspace, the private `screenshots` bucket and its read policy. |
| Repository secret scan | Pass | No `sb_secret_`, `sb_publishable_`, `sk-ant-` keys or the database password in tracked/untracked, non-ignored files. `.env.local` is gitignored. |
| Live Auth email flow, Anthropic API, worker against the hosted DB, deployed website | Unverified | Not exercised. The worker has never been run and the generator has never called the API. |

The PowerShell `npm` shim was blocked by execution policy. The equivalent `npm.cmd` scripts ran successfully.

## Feature audit

Classification reflects code evidence and checks above, not a deployed environment.

| Feature | Classification | Evidence / gap |
| --- | --- | --- |
| Email/password sign-up, sign-in, sign-out, session refresh, protected routes | Implemented and verified | Supabase Auth actions, callback, proxy session refresh, and server-side `requireUser`; covered indirectly by type/lint and auth-related route tests. Actual hosted email configuration unverified. |
| Email verification | Partially implemented | Signup handles the no-session confirmation flow and callback exists. Local Supabase config sets `enable_confirmations = false`; no end-to-end email verification test was run. |
| Forgot/reset password | Missing | No recovery action, reset route, or UI found. |
| Profile management, avatar, email/name updates, account deletion | Missing / partial | A profile row stores display name/email, but no profile settings flow or avatar storage. |
| Workspace create/switch/rename/delete; invitation lifecycle; member roles | Implemented and verified | Server actions, RLS policies, owner-preservation trigger, permission unit tests, and PGlite RLS tests. |
| Requested Owner/Admin/Developer/Tester/Viewer RBAC | Partially implemented | Current enum is owner/admin/member; fine-grained capability roles are absent. |
| Tenant isolation | Implemented and verified in local DB tests | Workspace membership-based helper policies and PGlite RLS tests. Production Supabase policy deployment remains unverified. |
| Clients CRUD and project association | Implemented and verified | Client routes/actions and project client FK/filtering. Archive, contact name/phone, client-specific activity timeline are absent. |
| Projects CRUD, URL/environment/client association | Implemented and verified | Project pages/actions and URL validation. Only one URL and one enum environment label per project; multi-environment configuration, secrets, browser defaults, archive/activity are missing. |
| Suites and cases, validation, step editor | Implemented and verified | Shared Zod parser/step language. Suites support create and delete only (no rename/edit action exists); test cases have full CRUD. Tags, priority, enable/disable, duplication, version history, reusable data, dependencies, and `type`/`uncheck` are absent. |
| AI test generation | Implemented and verified as a code path | Claude structured output, project-origin validation, review/edit/save, rate limiter, and step revalidation. Requires server `ANTHROPIC_API_KEY`; live provider execution was not verified. Individual regeneration and coverage suggestions are missing. |
| Page-error detection in runs | Implemented; detection verified live, stored results unverified | Migration `20261111000100_test_result_page_errors.sql` adds `test_results.page_errors` (worker-written; existing read-only RLS). Grouping/capping unit-tested in `src/lib/page-errors.test.ts`. The worker's listeners, run against `https://luxkitchens.com/` on 2026-11-11, recorded an HTTP 401 and two console errors. The hosted project is not CLI-linked: `20261111000000_page_snapshots.sql` was applied through the SQL Editor, and this migration must be applied the same way before the updated worker runs. |
| Generator page capture | Implemented; capture verified live, end-to-end flow unverified | Migration `20261111000000_page_snapshots.sql`: users may only queue a capture for their own projects (PGlite RLS tests in `tests/db/page-snapshots.test.ts`); `claim_next_page_snapshot()` is service-role only. Worker `worker/src/snapshot.ts` opens the page behind the same SSRF guard and rejects off-origin redirects. `capture()` was run against `https://www.wikipedia.org/` in local Chromium on 2026-11-11 and returned title, aria tree and form fields. The web → queue → worker → Claude round trip has not been run against the hosted database. |
| Manual run queue and run/result UI | Implemented and verified as a code path | Server action queues only; user cannot forge worker status/results through RLS. Runs list/detail show counts, logs, errors, and signed screenshot URLs. Live queue/storage behavior unverified. |
| Playwright worker | Implemented and verified in part | Separate Node process; atomic `FOR UPDATE SKIP LOCKED` claim; Chromium contexts, step/test timeouts, results, screenshots, cancellation check, stale-run recovery. No worker integration test against a live Supabase instance was run. |
| Worker reliability controls | Partially implemented | Atomic claims, concurrency setting, startup stale-run recovery, graceful shutdown exist. No heartbeat/lease, retry policy, duplicate-idempotency record, per-run resource limits, or active cancellation control. Startup-only stale recovery can leave jobs stuck until another worker restart. |
| Browser security / SSRF | **Partially implemented, with confirmed bypasses** | The guard checks scheme and resolved IP for requests that pass through `context.route`, and blocks cross-origin `goto`; unit tests cover IP classification. But (review pass) four bypasses exist: **(1) redirects** — Playwright documents that a route handler "will only be called for the first url if the response is a redirect", so a tested site can 302 the browser to `169.254.169.254` or an internal host; **(2) service workers** — the context does not set `serviceWorkers: "block"`, and Playwright does not route requests made by service workers; **(3) WebSockets** — not routed by `context.route`; **(4) DNS rebinding** — the guard resolves DNS, then Chromium resolves again independently. Sensitive ports are not restricted. See TECHNICAL_DEBT.md item 0. |
| Schedules | Implemented and verified as a code path | CRUD, cron/time zone validation, atomic due-schedule claims, scheduler loop, next-fire computation and recovery of claimed schedules. Worker must be persistently running; live schedule execution unverified. |
| Test result evidence and reports | Partially implemented | Step logs, errors, console/page errors, failure screenshots, signed URLs, result/run history exist. Browser/environment/commit SHA metadata, step-result rows, downloadable CSV/PDF, and comparisons absent. Failed network requests are logged by worker but not persisted into a dedicated field. |
| Flaky tests and dashboard metrics | Implemented and verified in part | SQL view and daily stats are derived from saved runs/results; aggregation tests exist. Flaky rate currently means failed/(pass+fail) among tests with both pass and fail; no environment comparison. |
| AI failure analyzer | Missing | No analysis route/action/table/provider flow found. |
| Issue / bug management | Partially implemented | Initial issues table, status/severity, and RLS exist, but no issue routes/components/actions/navigation were found. Assignment, comments, labels, due dates, lifecycle statuses, and create-from-failure flow absent. |
| Uptime monitoring | Missing | No monitor/check schema or worker path found. |
| GitHub integration | Missing | No OAuth, repository, webhook, commit, or PR status implementation found. |
| Notifications and activity history | Missing | No notification/activity schema or user-facing feature found. |
| Analytics / reporting | Partially implemented | Dashboard pass rate, run totals, durations, queued/running counts, schedule count and recent runs are DB-derived. Broader reports/exports and issue/uptime metrics absent. |
| Database schema / migrations | Implemented and verified (PGlite tests + applied to the hosted dev project) | Three migration files (**not yet committed to git**) define profiles, workspaces, clients, projects, suites/cases, runs/results, issues, schedules, functions, RLS and screenshot bucket policy. No `supabase/seed.sql` exists although `supabase/config.toml` references it. |
| CI | Implemented, CI execution unverified locally | GitHub Actions runs typecheck, lint, tests, build on push/PR. Workflow execution status was not inspected. |
| Deployment and operations | Missing / unverified | No deployment configs, production runbook, monitoring/backup setup, or documented web/worker hosting found. `qahub.cloud` appears in the blueprint only; no deployment verification performed. |

## Architecture and environment

- Next.js 16 App Router with server-rendered pages/actions; the app uses Supabase publishable credentials and request-scoped sessions.
- PostgreSQL RLS is the primary data boundary. Privileged run and result writes are reserved for the standalone worker.
- The worker reads `worker/.env`; required values are `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Optional settings control polling, concurrency, step/test timeouts, and startup stale-run age.
- Web `.env.example` requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `NEXT_PUBLIC_SITE_URL` and `ANTHROPIC_API_KEY` support auth callbacks and generation.
- The browser worker uses an allowlisted declarative step language; it does not evaluate arbitrary test JavaScript.
- Screenshots are intended for a private `screenshots` bucket with project-scoped read policy and short-lived signed URLs.
- CI targets Node 22 and runs `npm ci`, typecheck, lint, tests, and production build.

## Material risks and blockers

0. **(Critical, found in review) The worker's SSRF guard can be bypassed.** Redirects, service workers, WebSockets and DNS rebinding all reach the network without the IP check. Until fixed, do not run the worker against sites you don't control, and never on a host that can reach cloud metadata or internal services.
0b. **(Critical, found in review) None of the application is under version control.** `git log` shows only the create-next-app commit; every feature, migration and test is untracked. One accidental `git clean` or disk loss erases the project. Commit to a feature branch before further work.
0c. **Credentials were shared outside the repository.** The Supabase secret key and database password were pasted into an AI chat session and used on a command line. They are not in the repository, but should be rotated before any production use.
1. **No evidence of deployed operation.** Local tests cannot prove the hosted Auth redirect configuration, deployed migrations/RLS, screenshot bucket policy, worker credentials, Chromium host setup, or domain availability.
2. **Queue reliability is short of the blueprint.** There is no lease/heartbeat or retry control; stale-run recovery only runs at worker startup. A worker that hangs can keep a run in `running` indefinitely.
3. **Worker result persistence is best-effort.** If inserting an individual result fails, the error is logged and execution continues; final run totals can therefore describe results that were not persisted.
4. **AI provider abstraction is absent.** The generator imports Anthropic directly, so switching providers requires code changes.
5. **Rate limiting is process-local.** It resets on restart and is not shared across app instances, so it is not production-grade abuse control.
6. **Product claims exceed implementation.** The landing page advertises AI failure analysis and bug tracking even though those flows are absent; the README roadmap understates already implemented worker/schedule/UI features.
7. **Supabase seed configuration points at a missing file.** Local reset/development setup may fail or omit intended fixtures until a seed is created or config is corrected.

## Recommended next milestone

First, two blocking items from the review pass:

- Commit the current work to a branch.
- Close the worker SSRF bypasses: block service workers, refuse redirects to blocked addresses, block WebSockets to unvetted hosts, and route browser traffic through an egress proxy (or pinned-DNS resolver) so the checked IP is the one Chromium connects to; add integration tests that serve a redirect to a private address.

Then proceed with **Milestone 2 completion plus the queue reliability portion of Milestone 3**, before adding AI analysis, issues, monitoring, or integrations:

1. Fix the seed/config mismatch and document verified local Supabase startup.
2. Implement password recovery/reset and basic profile settings, or explicitly narrow the acceptance checklist.
3. Add separate project environment records before introducing credentials; define encryption/access policy first so secrets never enter browser queries or logs.
4. Expand workspace RBAC only with a clear capability matrix and migration/RLS tests.
5. Add worker heartbeat/lease renewal, stale lease recovery, retry policy, result-write failure handling, and active cancellation semantics.
6. Test the worker against a disposable/local Supabase stack, including queue contention, cancellation, redirects, screenshot policy, and crash recovery.
7. Update README and user-facing landing claims to match the shipped features.

Do not claim production-ready or deployed until a real staging environment passes end-to-end acceptance checks.
