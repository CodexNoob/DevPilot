# DevPilot Feature Status

**As of:** 2026-11-09. Status is based on repository inspection; “verified” means the existing local check suite or a focused test provides evidence. It does not imply production deployment.

## Status key

- **Implemented and verified:** code exists and relevant automated checks pass.
- **Implemented but unverified:** code exists, but execution depends on external services or lacks direct integration coverage.
- **Partially implemented:** a foundation or subset exists, with important blueprint behavior missing.
- **Missing:** no meaningful implementation found.

## Modules

| Module | Status | Current implementation | Remaining work |
| --- | --- | --- | --- |
| Authentication | Partially implemented | Supabase email/password sign-up/sign-in/out, callback, protected routes, session refresh. Typecheck/lint pass. | Password recovery/reset, profile/settings, avatar, account deletion; hosted email flow verification. |
| Workspaces and teams | Implemented and verified | Create/switch/rename/delete, invites, accept/decline/revoke, role changes/removal, owner invariant, RLS tests. | Blueprint roles Developer/Tester/Viewer; activity; broader settings. |
| Clients | Implemented and verified | Workspace-scoped CRUD, contact email/notes, project association and project filtering. | Archive, richer contact fields, client history/activity. |
| Projects | Partially implemented | CRUD, name/description/base URL, one environment enum, optional client, suites and recent runs. | Multiple environment URLs, credentials/secrets, defaults, archive, activity and project stats. |
| Test suites/cases | Partially implemented | Suite create/delete (no edit); case create/edit/delete; controlled step parser and validation. | Suite edit/archive/enable, priority/tags, duplicate/version history, reusable data/dependencies, `type`/`uncheck`. |
| AI test generator | Implemented but unverified against provider | Claude structured JSON, safe review/edit/save, suite selection, server validation, process-local rate limiting. Live page capture (2026-11-11): the worker opens the exact page entered, records its accessibility tree and form controls, and Claude writes selectors from that; every test must start with `goto` to that page (checked on generate and save). | Provider abstraction, per-case regeneration, test coverage suggestions, durable usage tracking, live API test, capture behind a login. |
| Execution queue and worker | Partially implemented | PostgreSQL atomic claims, Chromium execution, isolated contexts, per-step and per-test timeouts, logs, results, screenshots, concurrency and startup recovery. | Heartbeat/lease, automatic retry, active cancellation, idempotency, resource limits, robust integration tests. |
| Test results/history | Partially implemented | Run list/detail, status/counts/duration, logs, errors, signed screenshots, rerun queued runs. Automatic page-error detection (2026-11-11): uncaught JS errors, console errors, HTTP 4xx/5xx and failed requests are grouped per result (`test_results.page_errors`) and totalled on the run page; they are reported, not used to fail tests. Tests without an `expect-*` step can no longer be saved and are reported as failed. | Browser/environment/commit metadata, step results, exportable reports, comparisons, persisted request failures. |
| AI failure analysis | Missing | — | Evidence-backed structured analysis, feedback/regeneration, explicit facts vs hypotheses. |
| Issue management | Partially implemented | Database table, status/severity, optional result link, RLS. | UI and actions, assignment, comments, labels, priority, due dates, history, full status lifecycle and failure conversion. |
| Scheduling | Implemented but unverified against live worker | Cron/time-zone schedules, pause/resume/delete, atomic claim and next-run calculation. | Live deployment verification, schedule history and failure notification. |
| Uptime monitoring | Missing | — | Monitor config, HTTP/SSL checks, history, downtime/recovery events. |
| Flaky test reporting | Implemented and verified in part | SQL derives tests with both pass/fail in rolling 30-day window; UI shows counts/rate; relevant data comes from real results. | Environment comparisons, changing reliability trend and broader stability indicators. |
| Analytics/reporting | Partially implemented | Workspace dashboard derives pass rate, runs, durations, queue counts, schedules, recent runs. | Reports by project/suite, CSV/PDF export, failure and issue analytics. |
| GitHub | Missing | — | OAuth/repo linking, webhook/PR triggers, commit SHA, status checks. |
| Notifications/activity | Missing | — | In-app/email/Slack notifications and auditable activity timeline. |
| Security/tenant isolation | Partially implemented | Tenant isolation: server actions validate/authenticate; RLS tests in PGlite; migrations, private bucket and storage policy confirmed on the hosted dev project; no secrets in the repository. **Worker SSRF guard has confirmed bypasses** (redirects, service workers, WebSockets, DNS rebinding). | Fix SSRF bypasses with integration tests; distributed rate limiting; worker resource isolation/port policy; full threat-model tests; rotate credentials shared during development. |
| Production deployment | Missing / unverified | CI workflow and environment templates exist. | Deploy web, Supabase, persistent worker/scheduler; domain, secrets, monitoring, backups, rollback documentation. |

## Quality checks run

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd test` | Passed: 14 files, 185 tests |
| `npm run build` | Passed (review pass): 25/25 routes |
| `supabase migration list` (hosted dev project) | 3/3 migrations applied, matching local files |

The hosted dev database was only read. No Anthropic call, worker run, storage upload, or production domain was exercised.

**Version control:** all application code is currently untracked (only the create-next-app commit exists). Nothing above is protected until it is committed.
