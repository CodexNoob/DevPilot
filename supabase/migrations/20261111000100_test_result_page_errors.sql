-- Errors the page produced while a test ran (uncaught exceptions, console
-- errors, HTTP 4xx/5xx responses, failed requests), recorded by the worker
-- whether or not the test's steps checked for them. Grouped and capped by the
-- worker; see src/lib/page-errors.ts. Users can read but never write results
-- (existing test_results policies), so these cannot be forged.

alter table public.test_results
  add column page_errors jsonb not null default '[]'::jsonb
  check (jsonb_typeof(page_errors) = 'array' and jsonb_array_length(page_errors) <= 100);
