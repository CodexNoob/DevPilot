# DevPilot Development Roadmap

This roadmap follows the supplied product blueprint while keeping the existing implementation intact. Status reflects the 2026-11-09 repository audit.

## Milestone 1 — Repository and architecture audit: complete

- Inspected routes, features, migrations/RLS, worker, environment templates, CI and tests.
- Ran typecheck, lint and Vitest: all pass (185 tests).
- Created `IMPLEMENTATION_AUDIT.md`, `FEATURE_STATUS.md`, `TECHNICAL_DEBT.md`, and this roadmap.
- Production services and deployment remain unverified.
- Review pass: production build passes; hosted dev DB has all 3 migrations; no secrets in the repo. Found two blocking issues (below).

## Milestone 1.5 — Blocking fixes from the review: do first

1. Commit all current work to a feature branch (nothing beyond create-next-app is tracked).
2. Close the worker SSRF bypasses (redirects, service workers, WebSockets, DNS rebinding) and add integration tests that prove it — see TECHNICAL_DEBT.md item 0.
3. Rotate the Supabase secret key and database password that were shared during development.

**Acceptance:** `git log` contains the application; a test page that redirects to `169.254.169.254`, registers a service worker, or opens a WebSocket to a private address is blocked and logged.

## Milestone 2 — Core SaaS acceptance: next

1. Fix missing Supabase seed/config reference and define repeatable local DB setup.
2. Add password recovery/reset and basic profile/settings flows.
3. Verify signup confirmation configuration for local and production.
4. Decide whether roles remain owner/admin/member or expand; define explicit capability matrix and test it against RLS.
5. Add project environment records; do not implement secrets until worker-only access and encryption are designed.
6. Add case duplication and immutable definition history if runs must reproduce the exact test version.
7. Update README and landing copy to match present behavior.

**Acceptance:** auth recovery/profile journeys work; each role has tested allowed/denied operations; workspace RLS tests cover new data; local reset/seed succeeds; project environments persist independently.

## Milestone 3 — Reliable execution engine

1. Add worker leases/heartbeats and recover expired leases without waiting for process restart.
2. Make result persistence idempotent and ensure run totals match stored results.
3. Implement cancellation semantics for queued and active work, including an in-progress browser test.
4. Add bounded retries for transient infrastructure errors and capture attempt history.
5. Add worker integration tests for competing claims, crash recovery, cancellation, timeout, redirects, and screenshot access.
6. Document/deploy resource and network isolation for the persistent worker.

**Acceptance:** no duplicate claims; every completed run reconciles to stored results; cancellation and recovery complete within defined bounds; SSRF and resource policies are tested.

## Milestone 4 — AI functionality

1. Add a provider contract and keep Anthropic as the first adapter.
2. Store generation usage/cost metadata and enforce shared rate limits.
3. Add individual case regeneration and coverage suggestions after review flow is stable.
4. Build failure analysis only from persisted test evidence, with facts/hypotheses separated and feedback captured.

**Acceptance:** malformed AI output is rejected; generated tests remain unexecuted until user queues them; provider failures/rate limits are safe; analysis claims are traceable to evidence.

## Milestone 5 — Bug management

1. Implement issue list/detail/create/edit and conversion from failed test result.
2. Add assignment, comments, labels, priority/due date and activity history.
3. Define status workflow including reopened and won't-fix if still needed.
4. Add role/RLS tests for issue operations.

**Acceptance:** issue links to project/test/result within the same tenant; complete lifecycle is available in UI and audit history.

## Milestone 6 — Scheduling and monitoring

1. Verify schedule claiming and catch-up behavior with live worker integration tests.
2. Add schedule execution history and notification hooks.
3. Implement uptime monitors with isolated HTTP checks, SSL expiry handling, history, and downtime/recovery detection.

**Acceptance:** due schedules enqueue once across concurrent workers; uptime results reflect actual checks and emit transitions once.

## Milestone 7 — Analytics and integrations

1. Add project/suite reports and CSV export using stored data.
2. Implement notification and activity-log primitives.
3. Add GitHub OAuth/repository association and webhook-triggered PR runs only after queue acceptance is solid.
4. Add commit SHA/PR status persistence and permission review.

**Acceptance:** every dashboard/report metric derives from DB records; integrations are tenant-scoped and webhook-authenticated.

## Milestone 8 — Security and quality assurance

- Add end-to-end tests for signup/recovery, workspace isolation, authoring, queue execution, screenshots, and issue flow.
- Add integration tests against disposable Supabase (migration, RLS, Storage, Auth).
- Add dependency/security scan and threat review for worker egress, credentials, logs, and file access.
- Confirm CI build and quality jobs pass on the main branch.

## Milestone 9 — Production deployment

- Provision separate staging and production Supabase projects.
- Deploy Next.js app and persistent isolated Playwright worker/scheduler.
- Configure production auth redirect URLs, secrets, private storage policy, domain/HTTPS, backups, error monitoring and alerting.
- Exercise migration, worker restart, queue recovery, backup restore and rollback procedures.

## Milestone 10 — Release and presentation

- Complete production acceptance checklist with evidence.
- Publish architecture/security/worker/deployment documentation and screenshots.
- Update README and public claims; publish only after deployment and worker workflows are confirmed.
- Prepare a demo scenario that shows test authoring, real browser execution, failure evidence and issue lifecycle.

## Current stop/go recommendation

Do not begin broad feature expansion or describe DevPilot as production-ready yet. Do Milestone 1.5 first (commit, SSRF fixes, credential rotation). After that, the next useful slice is Milestone 2 acceptance work and queue reliability: it closes foundational correctness and account gaps before adding analysis, integrations, or monitoring.
