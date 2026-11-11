import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

/**
 * Runs the real Supabase migrations inside PGlite (Postgres compiled to WASM)
 * so RLS policies can be tested without Docker or a hosted project.
 *
 * The shim reproduces only the parts of Supabase the migrations rely on:
 * the API roles, `auth.users`, `auth.uid()`, and Supabase's default grants.
 */
const SUPABASE_SHIM = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key,
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant execute on function auth.jwt() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/** Email given to users created by `createUser`; also placed in their JWT claims. */
export const emailFor = (userId: string) => `${userId}@example.test`;

/** Inserts an auth user (as a superuser, like Supabase Auth would). */
export async function createUser(db: PGlite, displayName?: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, emailFor(id), JSON.stringify(displayName ? { display_name: displayName } : {})],
  );
  return id;
}

type Role = "anon" | "authenticated" | "service_role";

const claims = (role: Role, userId: string | null) =>
  JSON.stringify(userId ? { sub: userId, role, email: emailFor(userId) } : { role });

/** The personal workspace created for a user at signup. */
export async function personalWorkspace(db: PGlite, userId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.workspaces where created_by = $1 order by created_at limit 1",
    [userId],
  );
  return rows[0]!.id;
}

/**
 * Executes `fn` inside a transaction impersonating a PostgREST request:
 * `set local role` + JWT claims, exactly how Supabase evaluates RLS.
 * The transaction is always rolled back so tests stay isolated.
 */
export async function as<T>(
  db: PGlite,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result!: T;
  const rollback = new Error("rollback");
  try {
    await db.transaction(async (tx) => {
      await tx.query(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims(role, userId)]);
      result = await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}

/** Like `as`, but commits — for fixture setup that later tests depend on. */
export async function asCommitted<T>(
  db: PGlite,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims(role, userId)]);
    return fn(tx);
  });
}
