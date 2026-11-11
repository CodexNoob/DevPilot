# DevPilot

**AI-powered software testing & QA platform.** Test smarter. Catch bugs earlier. Ship with confidence.

Connect a website, run automated Playwright browser tests against it, keep every result (logs, durations, screenshots), get AI explanations for failures, and track the bugs they reveal.

> **Status:** Phase 1 (foundation). Authentication, dashboard, project and test-suite management, and the full database schema with Row Level Security are done. Test execution arrives in Phase 2.

## Tech stack

| Area | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4, shadcn/ui (Base UI primitives), lucide icons |
| Data and auth | Supabase: Postgres, Auth, Storage (Phase 2) |
| Validation | Zod |
| Testing | Vitest; PGlite for database/RLS tests |
| Test engine (Phase 2) | Playwright in a separate Node.js worker |

## Getting started

Requirements: Node.js 22+ and a [Supabase](https://supabase.com) project (the free tier is fine).

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
```

Apply the database schema to your Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations
npm run db:types              # optional: regenerate src/lib/supabase/database.types.ts
```

In the Supabase dashboard, under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.

```bash
npm run dev
```

> **Windows:** keep the project in a path without `&` (for example, not `C:\dev\QA & Testing\`). npm runs scripts through `cmd.exe`, which splits paths at `&`, so every `npm run …` command fails.

## Test worker

Test runs are executed by a separate Node.js process in [worker/](worker/). It polls Supabase for queued runs, drives Chromium with Playwright, and writes results, logs and failure screenshots back. It also enqueues runs for due schedules. The worker is the only component that holds the Supabase **secret** (service-role) key, and it exposes no HTTP endpoint.

```bash
npm run worker:install-browsers   # once: downloads Chromium for Playwright
cp worker/.env.example worker/.env # then set SUPABASE_URL and SUPABASE_SECRET_KEY
npm run worker
```

How it works:

- **Queue.** `claim_next_run()` atomically moves the oldest queued run to `running` with `FOR UPDATE SKIP LOCKED`, so you can run several workers (or set `WORKER_CONCURRENCY`) without double-processing.
- **Schedules.** `claim_due_schedules()` claims due schedules the same way. The worker enqueues a `scheduled` run and computes the next fire time from the cron expression and time zone.
- **Execution.** Each test case runs in a fresh browser context (1280×720) with a per-step timeout (`WORKER_STEP_TIMEOUT_MS`) and a per-test timeout (`WORKER_TEST_TIMEOUT_MS`). Steps are re-validated with the shared schema in `src/lib/test-steps.ts`, and `goto` may only navigate within the project's origin.
- **SSRF defence.** Every browser request is checked against the hostname's *resolved* addresses. Requests to loopback, private, link-local (incl. cloud metadata), CGNAT, multicast, unique-local and IPv4-mapped IPv6 addresses are aborted, which also defeats DNS rebinding. Non-http(s) schemes are blocked, except `data:` and `blob:`.
- **Results.** Each test case writes a `test_results` row (status, duration, step-by-step log, console errors, failed requests). On failure it also uploads a screenshot to the private `screenshots` bucket at `<project_id>/<run_id>/<result_id>.png`. The run then gets its final status and counts, unless a user cancelled it meanwhile.
- **Recovery.** On startup, runs stuck in `running` longer than `WORKER_STALE_RUN_MINUTES` are marked `error`. `Ctrl+C` finishes current runs before exiting (press twice to force).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate route types and run `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests and database/RLS tests |
| `npm run check` | Type-check, lint and test |
| `npm run worker` | Start the test worker (reads `worker/.env`) |
| `npm run worker:install-browsers` | Download Chromium for the worker |

## Project structure

```text
src/
  app/
    (auth)/              login, signup (public)
    (dashboard)/         authenticated app shell: overview, projects
    auth/callback/       email-confirmation code exchange
  features/
    auth/                schemas, server actions, forms
    projects/            schemas, queries, server actions, components
    dashboard/           metrics queries and pure aggregation logic
  components/            shared app components (forms, headers, empty states)
  components/ui/         shadcn/ui primitives
  lib/
    supabase/            per-request server client, proxy session refresh, DB types
    auth.ts              data access layer: getCurrentUser / requireUser
    action-state.ts      typed Server Action results and safe error mapping
    routes.ts            route classification and open-redirect-safe `next` handling
  proxy.ts               session refresh and optimistic auth redirects
supabase/migrations/     SQL schema, constraints and RLS policies
tests/db/                migration and RLS tests running on PGlite
```

Code is grouped **by feature**: each module owns its validation, data access, mutations and UI. Shared code moves to `components/` or `lib/` only once more than one feature needs it.

## Architecture decisions

**1. The database is the security boundary.** Every query runs as the signed-in user through the Supabase publishable key, so Postgres Row Level Security decides which rows are visible. The service-role key is never used by the web app. Authorization is checked in three layers:

- the proxy redirects signed-out users (for UX only);
- each page and Server Action calls `requireUser()`, which verifies the JWT with `getClaims()`;
- RLS allows each row only for its owner.

**2. Worker-owned writes.** Users can *queue* a run (`status = 'queued'`, `trigger = 'manual'`) but cannot change a run's status or insert results. Those writes belong to the Phase 2 test worker, which runs on its own host with the service role. This makes it impossible to fake a passing run from the browser.

**3. Composite foreign keys for tenant integrity.** Child tables store `project_id` and reference their parent by `(id, project_id)`. A run can't point at a suite in another project, and an issue can't link to another user's test result. Postgres enforces this even for privileged writers such as the worker. It also keeps RLS checks to a single indexed lookup.

**4. Cache Components with fresh data.** Next.js 16 prerenders each page's static shell. Anything that reads the session streams in behind `<Suspense>` with skeleton fallbacks. Database reads are deliberately not cached: QA results must be current, and RLS-scoped reads are per-user anyway. Mutations call `refresh()` or redirect.

**5. Validated twice.** Zod validates every Server Action input, and Postgres `CHECK` constraints repeat the critical rules (URL scheme, length limits). Database errors are mapped to safe user-facing messages and never shown raw.

**6. SSRF-aware URL validation.** Project URLs are normalised. Loopback, private, link-local, cloud-metadata and IPv4-mapped IPv6 hosts are rejected. This is only the first layer: the Phase 2 worker must re-check the *resolved* IP when it connects, to defeat DNS rebinding.

**7. Testing RLS without Docker.** `tests/db` loads the real migrations into [PGlite](https://pglite.dev) (Postgres compiled to WASM) behind a small shim of Supabase's `auth` schema and roles. It then checks the policies by impersonating users, just as PostgREST does. These tests run in CI with no external services.

## Database schema

```text
auth.users ─1:1─ profiles
profiles ─1:n─ projects ─1:n─ test_suites
                        ├─1:n─ test_runs ─1:n─ test_results
                        └─1:n─ issues ──(optional)── test_results
```

All tables have RLS enabled. Access resolves through `private.owns_project(project_id)`, a `SECURITY DEFINER` helper that lives in a schema the API doesn't expose. Team and organisation membership is planned for Phase 4.

## Roadmap

- **Phase 1, Foundation (done):** auth, dashboard, project CRUD, test suites, schema and RLS, tests, CI.
- **Phase 2, Testing engine:** Playwright worker, run queue, result persistence, logs, failure screenshots in Supabase Storage.
- **Phase 3, AI and bug management:** AI failure analysis, suggested debugging steps, issue tracking and history.
- **Phase 4, Production readiness:** scheduled runs, uptime monitoring, analytics, teams and permissions, documentation.

## License

All rights reserved. A license will be chosen before the public release.
