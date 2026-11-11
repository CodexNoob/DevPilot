import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { Constants } from "@/lib/supabase/database.types";
import { createTestDatabase } from "./harness";

/**
 * Guards against drift between the SQL migrations and the TypeScript
 * database types until types are generated from a linked project.
 */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

describe("database.types.ts", () => {
  it("enum constants match the database", async () => {
    const { rows } = await db.query<{ name: string; values: string[] }>(`
      select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as values
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
      group by t.typname
    `);
    const fromDb = Object.fromEntries(rows.map((r) => [r.name, r.values]));
    expect(fromDb).toEqual(Constants.public.Enums);
  });

  it("public tables match the typed tables", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    // information_schema.tables includes views (flaky_tests).
    expect(rows.map((r) => r.table_name)).toEqual([
      "clients",
      "flaky_tests",
      "generation_rate_limits",
      "issues",
      "page_snapshots",
      "profiles",
      "projects",
      "schedules",
      "test_cases",
      "test_results",
      "test_runs",
      "test_suites",
      "workspace_invitations",
      "workspace_members",
      "workspaces",
    ]);
  });
});
