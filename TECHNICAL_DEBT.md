# DevPilot Technical Debt and Risks

Audit date: 2026-11-09. Items are based on repository inspection; priority is ordered by risk to correctness or product claims.

## Critical before production

### 0. Worker SSRF guard has confirmed bypasses (found in review)

`worker/src/run.ts` guards traffic with `context.route("**/*")`, which does not see everything the browser sends:

- **Redirects.** Playwright's own documentation (`node_modules/playwright-core/types/types.d.ts`): "The handler will only be called for the first url if the response is a redirect." A tested page at a public IP can `302` to `http://169.254.169.254/` or an internal service and the guard never runs.
- **Service workers.** `browser.newContext()` does not set `serviceWorkers: "block"`; Playwright does not route requests made by service workers.
- **WebSockets.** Not routed by `context.route`; page JavaScript can open `ws://10.0.0.5/`.
- **DNS rebinding.** The guard resolves the hostname, then Chromium resolves it again; a low-TTL record can answer "public" to the guard and "private" to the browser.

**Recommendation:** set `serviceWorkers: "block"`; check `response.request().redirectedFrom()` chains and abort navigations that land on blocked addresses; use `context.routeWebSocket` to block unvetted hosts; and, for a real fix, force all browser traffic through an egress proxy that resolves once and connects to the vetted IP (or deny private ranges at the network layer of the worker's container). Add integration tests with a local HTTP server that redirects to a private address and registers a service worker.

**Until fixed:** run the worker only against sites you control, on a host with no access to cloud metadata or internal services.

**Scope (2026-11-11):** the generator's page capture (`worker/src/snapshot.ts`) reuses `guardContext`, so it has the same bypasses and needs the same fix.

### 0b. No application code is under version control (found in review)

The repository has a single create-next-app commit; every feature, migration, test and the worker are untracked. Commit to a feature branch before further work.

### 1. Queue jobs have no renewable lease or heartbeat

`claim_next_run()` changes a queued run to `running`, but ownership/lease expiry is not recorded. `recoverAbandonedRuns()` only checks old `started_at` values at worker startup. A worker that remains alive but hangs can leave work stuck, and multiple workers cannot safely determine whether a slow job is still active.

**Recommendation:** add `worker_id`, lease expiry/heartbeat fields and atomic lease renewal; reclaim expired runs under a transaction. Test crash, pause, and concurrent claim paths.

### 2. Individual result writes can fail silently relative to run totals

`runTestCase()` logs a failed `test_results` insert and returns its in-memory status. The run can then finish as passed/failed with totals that do not match persisted result rows.

**Recommendation:** make persistence failure a run-level infrastructure error or retry safely using deterministic result IDs and idempotent writes.

### 3. No live integration evidence

The test suite uses PGlite and focused unit tests. No evidence in the repository proves migration application to a hosted project, Auth email settings, storage policies, worker queue connectivity, or deployed browser execution.

**Recommendation:** create a disposable Supabase-backed integration environment and a staging acceptance checklist. Keep production secrets outside repository and CI logs.

### 4. Missing worker retry and active cancellation model

There is no attempt counter/backoff/dead-letter policy. `cancel_run` accepts only queued runs; a worker notices a run no longer running between test cases, but there is no explicit active cancellation request or interruption during a currently executing case.

**Recommendation:** define cancellation states and worker polling/abort behavior, then add bounded retry policy for infrastructure failures only.

### 5. Worker isolation and resource controls are incomplete

The network guard blocks many unsafe address ranges and cross-origin `goto`, but sensitive ports are not restricted. No container sandbox, CPU/memory cap, process isolation policy, or execution resource limit is represented in repository config.

**Recommendation:** deploy worker in an isolated container/network policy; limit ports, CPU, memory, disk, execution time, and outbound access. Verify redirects and browser subresource requests in integration tests.

## High priority

### 6. Supabase config references a missing seed file

`supabase/config.toml` enables seeding and points to `./seed.sql`, but no `supabase/seed.sql` is present.

**Recommendation:** add safe local-only seed data or disable the seed reference until it exists.

### 7. Process-local AI generation rate limit

The limiter is in memory, so it resets on restart and is independently enforced per web instance.

**Recommendation:** use a database-backed or shared rate-limit store and record AI usage for cost control.

### 8. AI provider is coupled to Anthropic

The generator calls the Anthropic SDK directly and has no provider interface, despite the blueprint’s provider-abstraction goal.

**Recommendation:** define a small server-only provider contract around structured generation and map provider errors into a shared safe result type.

### 9. README and landing page misstate shipped functionality

README says test execution is future phase although a worker, schedules, run pages, and evidence flow exist. Landing copy advertises AI failure analysis and bug tracking while there is no analysis UI and only an issues table without user-facing CRUD.

**Recommendation:** align docs and marketing claims with the implementation status before public demonstration.

### 10. Authentication/account scope is incomplete

No forgot/reset password or profile settings routes/actions are present. Local Supabase config disables email confirmation while app handles the confirmation-enabled case.

**Recommendation:** decide intended local/production email behavior; implement and test recovery/reset and basic profile management.

### 11. Workspace role model is narrower than the blueprint

Database supports owner/admin/member only. UI/action/RLS behavior therefore cannot express developer, tester, and viewer read-only permissions.

**Recommendation:** document capability matrix and migrate app actions and RLS policies together. Add negative tests for each role/action pair.

### 12. Environment modeling is a single project label

Project `environment` is an enum label (production/staging/development), not a collection of named target URLs. No environment variables/secrets model exists.

**Recommendation:** add project environment records with strict workspace/project scoping; design secret encryption and worker-only retrieval before accepting credentials.

## Medium priority

### 13. Test authoring metadata and history are limited

Cases have name, description, suite, source, and steps. No priority/tags, duplication, version history, reusable data, or dependency support exists.

**Recommendation:** prioritize duplication and immutable version history before adding tags/dependencies; keep old run results tied to the tested definition version.

### 14. Issue schema is ahead of its product UI

An issue table exists but there are no issue routes, actions, assignment/comments, or workflow. Current statuses are only open/in_progress/resolved/closed.

**Recommendation:** implement one complete workflow from failed result to issue, assignment, status change, and audit history before claiming bug tracking.

### 15. Result evidence omits some requested metadata

Run/result persistence lacks browser/environment/commit SHA, dedicated per-step rows, and downloadable reports. Failed network requests are not stored in their own result field.

**Recommendation:** add metadata to the run record and persist step outcomes as structured rows before expanding report exports.

### 16. Missing seed, product docs, and deployment docs

No `docs/` directory, deployment runbook, architecture/database/security/API/worker docs, screenshots, or local seed data were found. README has useful setup notes but stale roadmap claims.

**Recommendation:** maintain concise docs alongside each milestone; document exact worker hosting, secrets, backup, recovery and rollback steps.

### 17. No uptime/integration/notification subsystems

No uptime monitor, GitHub integration, notification, or activity-log schema/worker path was found.

**Recommendation:** defer these until queue reliability, account/workspace acceptance, and issue workflow are stable.

## Lower priority / product polish

- The step language lacks blueprint commands `type` and `uncheck`; current `fill` and `check` cover some related use cases.
- Dashboard does not report open issues, total test cases, flaky count, or per-project trend reports.
- CI workflow is present but repository inspection did not include a remote run status.
- No production deployment/rollback/backup evidence is committed.
