import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { as, asCommitted, createTestDatabase, createUser, emailFor, personalWorkspace } from "./harness";

let db: PGlite;
let alice: string;
let bob: string;
let carol: string;
let aliceWs: string;
let bobWs: string;
let aliceProject: string;
let aliceSuite: string;

const insertProject = async (tx: Transaction, workspaceId: string, name: string, url = `https://${name.toLowerCase()}.example.com`) => {
  const { rows } = await tx.query<{ id: string }>(
    "insert into public.projects (workspace_id, name, base_url) values ($1, $2, $3) returning id",
    [workspaceId, name, url],
  );
  return rows[0]!.id;
};

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "Alice");
  bob = await createUser(db);
  carol = await createUser(db, "Carol");
  aliceWs = await personalWorkspace(db, alice);
  bobWs = await personalWorkspace(db, bob);

  aliceProject = await asCommitted(db, "authenticated", alice, (tx) => insertProject(tx, aliceWs, "Shop"));
  aliceSuite = await asCommitted(db, "authenticated", alice, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      "insert into public.test_suites (project_id, name) values ($1, 'Checkout') returning id",
      [aliceProject],
    );
    return rows[0]!.id;
  });
}, 60_000);

const count = async (
  role: "anon" | "authenticated",
  user: string | null,
  table: string,
): Promise<number> =>
  as(db, role, user, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
    return rows[0]!.n;
  });

describe("signup", () => {
  it("creates a profile with display name and email", async () => {
    const profile = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ display_name: string | null; email: string }>(
        "select display_name, email from public.profiles where id = $1",
        [alice],
      );
      return rows[0];
    });
    expect(profile).toEqual({ display_name: "Alice", email: emailFor(alice) });
  });

  it("creates a personal workspace owned by the user", async () => {
    const membership = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ name: string; role: string }>(
        "select w.name, m.role from public.workspaces w join public.workspace_members m on m.workspace_id = w.id where m.user_id = $1",
        [alice],
      );
      return rows;
    });
    expect(membership).toEqual([{ name: "Alice's workspace", role: "owner" }]);
  });

  it("does not expose profiles of users outside your workspaces", async () => {
    expect(await count("authenticated", bob, "profiles")).toBe(1);
  });
});

describe("workspaces", () => {
  it("are visible only to members", async () => {
    expect(await count("authenticated", alice, "workspaces")).toBe(1);
    expect(await count("authenticated", bob, "workspaces")).toBe(1);
    await expect(count("anon", null, "workspaces")).rejects.toThrow(/permission denied/);
  });

  it("can be created with create_workspace, making the caller owner", async () => {
    const role = await as(db, "authenticated", bob, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select public.create_workspace('Agency') as id");
      const { rows: m } = await tx.query<{ role: string }>(
        "select role from public.workspace_members where workspace_id = $1 and user_id = $2",
        [rows[0]!.id, bob],
      );
      return m[0]?.role;
    });
    expect(role).toBe("owner");
  });

  it("cannot be inserted directly (no spoofed creator)", async () => {
    await expect(
      as(db, "authenticated", bob, (tx) =>
        tx.query("insert into public.workspaces (name, created_by) values ('Spoof', $1)", [alice]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("must keep at least one owner", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("update public.workspace_members set role = 'member' where workspace_id = $1 and user_id = $2", [
          aliceWs,
          alice,
        ]),
      ),
    ).rejects.toThrow(/at least one owner/);
  });
});

describe("invitations and membership", () => {
  it("non-admins cannot invite", async () => {
    await expect(
      as(db, "authenticated", bob, (tx) =>
        tx.query("insert into public.workspace_invitations (workspace_id, email) values ($1, 'x@example.test')", [
          aliceWs,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("owner cannot invite someone as owner", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query(
          "insert into public.workspace_invitations (workspace_id, email, role) values ($1, 'x@example.test', 'owner')",
          [aliceWs],
        ),
      ),
    ).rejects.toThrow(/workspace_invitations_role_check/);
  });

  it("only the invited email can accept", async () => {
    const result = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.workspace_invitations (workspace_id, email) values ($1, $2) returning id",
        [aliceWs, emailFor(carol)],
      );
      const invitationId = rows[0]!.id;

      // Switch to bob inside the same transaction: he can't see or accept it.
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: bob, role: "authenticated", email: emailFor(bob) }),
      ]);
      const { rows: visible } = await tx.query("select id from public.workspace_invitations");
      let bobError = "";
      await tx.query("savepoint s");
      try {
        await tx.query("select public.accept_invitation($1)", [invitationId]);
      } catch (error) {
        bobError = (error as Error).message;
      }
      await tx.query("rollback to savepoint s");

      // Carol sees the workspace name, accepts and becomes a member.
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: carol, role: "authenticated", email: emailFor(carol) }),
      ]);
      const { rows: invited } = await tx.query<{ workspace_name: string }>(
        "select workspace_name from public.my_invitations()",
      );
      const { rows: accepted } = await tx.query<{ ws: string }>("select public.accept_invitation($1) as ws", [
        invitationId,
      ]);
      const { rows: mine } = await tx.query<{ workspace_name: string }>("select workspace_name from public.my_invitations()");
      const { rows: projects } = await tx.query("select id from public.projects");
      const { rows: teammates } = await tx.query("select id from public.profiles where id = $1", [alice]);
      return { bobSaw: visible.length, bobError, invited: invited.map((r) => r.workspace_name), afterAccept: mine.length, ws: accepted[0]!.ws, projects: projects.length, teammates: teammates.length };
    });

    expect(result.bobSaw).toBe(0);
    expect(result.invited).toEqual(["Alice's workspace"]);
    expect(result.afterAccept).toBe(0);
    expect(result.bobError).toMatch(/Invitation not found/);
    expect(result.ws).toBe(aliceWs);
    expect(result.projects).toBe(1);
    expect(result.teammates).toBe(1);
  });

  it("users cannot add themselves to a workspace directly", async () => {
    await expect(
      as(db, "authenticated", carol, (tx) =>
        tx.query("insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')", [
          aliceWs,
          carol,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("projects", () => {
  it("members can read; outsiders and anon cannot", async () => {
    expect(await count("authenticated", alice, "projects")).toBe(1);
    expect(await count("authenticated", bob, "projects")).toBe(0);
    await expect(count("anon", null, "projects")).rejects.toThrow(/permission denied/);
  });

  it("defaults created_by to the caller", async () => {
    const createdBy = await as(db, "authenticated", bob, async (tx) => {
      const { rows } = await tx.query<{ created_by: string }>(
        "insert into public.projects (workspace_id, name, base_url) values ($1, 'Mine', 'https://bob.example.com') returning created_by",
        [bobWs],
      );
      return rows[0]!.created_by;
    });
    expect(createdBy).toBe(bob);
  });

  it("rejects creating a project in a workspace you don't belong to", async () => {
    await expect(as(db, "authenticated", bob, (tx) => insertProject(tx, aliceWs, "Spoof"))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("outsiders cannot update or delete the project (silently affects 0 rows)", async () => {
    const affected = await as(db, "authenticated", bob, async (tx) => {
      const u = await tx.query("update public.projects set name = 'pwned' where id = $1", [aliceProject]);
      const d = await tx.query("delete from public.projects where id = $1", [aliceProject]);
      return [u.affectedRows, d.affectedRows];
    });
    expect(affected).toEqual([0, 0]);
  });

  it("cannot be moved into a workspace you don't belong to", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("update public.projects set workspace_id = $1 where id = $2", [bobWs, aliceProject]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects non-http(s) base URLs at the database level", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) => insertProject(tx, aliceWs, "Bad", "javascript:alert(1)")),
    ).rejects.toThrow(/projects_base_url_check/);
  });

  it("enforces unique project names per workspace", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) => insertProject(tx, aliceWs, "Shop", "https://a.example.com")),
    ).rejects.toThrow(/projects_workspace_name_unique/);
  });

  it("maintains updated_at server-side, ignoring client-supplied values", async () => {
    const [updatedAt, now] = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ updated_at: Date; now: Date }>(
        "update public.projects set updated_at = '2000-01-01', description = 'x' where id = $1 returning updated_at, now()",
        [aliceProject],
      );
      return [rows[0]!.updated_at, rows[0]!.now];
    });
    expect(updatedAt.getTime()).toBe(now.getTime());
  });

  it("cannot reference a client from another workspace", async () => {
    const bobClient = await asCommitted(db, "authenticated", bob, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.clients (workspace_id, name) values ($1, 'Acme') returning id",
        [bobWs],
      );
      return rows[0]!.id;
    });
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("update public.projects set client_id = $1 where id = $2", [bobClient, aliceProject]),
      ),
    ).rejects.toThrow(/projects_client_fk/);
  });
});

describe("clients", () => {
  it("are managed by admins and hidden from outsiders", async () => {
    expect(await count("authenticated", alice, "clients")).toBe(0);
    expect(await count("authenticated", bob, "clients")).toBe(1);
  });
});

describe("test_suites and test_cases", () => {
  it("suites are visible only to workspace members", async () => {
    expect(await count("authenticated", alice, "test_suites")).toBe(1);
    expect(await count("authenticated", bob, "test_suites")).toBe(0);
  });

  it("suites cannot be created in someone else's project", async () => {
    await expect(
      as(db, "authenticated", bob, (tx) =>
        tx.query("insert into public.test_suites (project_id, name) values ($1, 'Evil')", [aliceProject]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("test cases require a steps array", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("insert into public.test_cases (project_id, suite_id, name, steps) values ($1, $2, 'x', '{}')", [
          aliceProject,
          aliceSuite,
        ]),
      ),
    ).rejects.toThrow(/test_cases_steps_check/);
  });

  it("test cases cannot be added to someone else's suite", async () => {
    await expect(
      as(db, "authenticated", bob, (tx) =>
        tx.query(
          `insert into public.test_cases (project_id, suite_id, name, steps) values ($1, $2, 'x', '[{"action":"goto","path":"/"}]')`,
          [aliceProject, aliceSuite],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("test_runs", () => {
  it("members can queue a manual run, numbered per project", async () => {
    const runs = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ status: string; triggered_by: string; number: number; branch: string }>(
        "insert into public.test_runs (project_id, suite_id) values ($1, $2), ($1, $2) returning status, triggered_by, number, branch",
        [aliceProject, aliceSuite],
      );
      return rows;
    });
    expect(runs).toEqual([
      { status: "queued", triggered_by: alice, number: 1, branch: "main" },
      { status: "queued", triggered_by: alice, number: 2, branch: "main" },
    ]);
  });

  it("users cannot fabricate results by inserting a finished run", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("insert into public.test_runs (project_id, status) values ($1, 'passed')", [aliceProject]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("users cannot fabricate counts on a queued run", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("insert into public.test_runs (project_id, passed_count, total_count) values ($1, 5, 5)", [
          aliceProject,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("users cannot change run status directly (worker-only)", async () => {
    const affected = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.test_runs (project_id) values ($1) returning id",
        [aliceProject],
      );
      const u = await tx.query("update public.test_runs set status = 'passed' where id = $1", [rows[0]!.id]);
      return u.affectedRows;
    });
    expect(affected).toBe(0);
  });

  it("members can cancel a queued run; outsiders cannot", async () => {
    const result = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.test_runs (project_id) values ($1) returning id",
        [aliceProject],
      );
      const id = rows[0]!.id;
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: bob, role: "authenticated", email: emailFor(bob) }),
      ]);
      const { rows: bobTry } = await tx.query<{ ok: boolean }>("select public.cancel_run($1) as ok", [id]);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: alice, role: "authenticated", email: emailFor(alice) }),
      ]);
      const { rows: aliceTry } = await tx.query<{ ok: boolean }>("select public.cancel_run($1) as ok", [id]);
      const { rows: status } = await tx.query<{ status: string }>("select status from public.test_runs where id = $1", [id]);
      return [bobTry[0]!.ok, aliceTry[0]!.ok, status[0]!.status];
    });
    expect(result).toEqual([false, true, "cancelled"]);
  });

  it("rejects a run whose suite belongs to a different project", async () => {
    await expect(
      as(db, "authenticated", alice, async (tx) => {
        const other = await insertProject(tx, aliceWs, "Other");
        await tx.query("insert into public.test_runs (project_id, suite_id) values ($1, $2)", [other, aliceSuite]);
      }),
    ).rejects.toThrow(/test_runs_suite_fk/);
  });

  it("computes duration from start and finish", async () => {
    const duration = await as(db, "service_role", null, async (tx) => {
      const { rows } = await tx.query<{ duration_ms: number }>(
        "insert into public.test_runs (project_id, status, started_at, finished_at) values ($1, 'passed', now() - interval '90 seconds', now()) returning duration_ms",
        [aliceProject],
      );
      return rows[0]!.duration_ms;
    });
    expect(duration).toBe(90_000);
  });
});

describe("worker functions", () => {
  it("users cannot call worker entry points", async () => {
    await expect(as(db, "authenticated", alice, (tx) => tx.query("select * from public.claim_next_run()"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      as(db, "authenticated", alice, (tx) => tx.query("select * from public.claim_due_schedules()")),
    ).rejects.toThrow(/permission denied/);
  });

  it("claim_next_run takes the oldest queued run and marks it running", async () => {
    const claimed = await as(db, "service_role", null, async (tx) => {
      await tx.query("insert into public.test_runs (project_id, created_at) values ($1, now() - interval '1 hour')", [
        aliceProject,
      ]);
      await tx.query("insert into public.test_runs (project_id) values ($1)", [aliceProject]);
      const { rows } = await tx.query<{ status: string; started_at: Date | null }>("select * from public.claim_next_run()");
      return rows;
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.status).toBe("running");
    expect(claimed[0]!.started_at).not.toBeNull();
  });

  it("claim_due_schedules returns due schedules and clears next_run_at", async () => {
    const result = await as(db, "service_role", null, async (tx) => {
      await tx.query(
        "insert into public.schedules (project_id, name, cron, next_run_at) values ($1, 'Due', '0 * * * *', now() - interval '1 minute'), ($1, 'Later', '0 * * * *', now() + interval '1 hour')",
        [aliceProject],
      );
      const { rows } = await tx.query<{ name: string; next_run_at: Date | null }>(
        "select name, next_run_at from public.claim_due_schedules()",
      );
      return rows;
    });
    expect(result).toEqual([{ name: "Due", next_run_at: null }]);
  });
});

describe("test_results, flaky tests and stats", () => {
  it("results cannot be written by users, but can be by the worker (service role)", async () => {
    const runId = await asCommitted(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.test_runs (project_id) values ($1) returning id",
        [aliceProject],
      );
      return rows[0]!.id;
    });

    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query(
          "insert into public.test_results (run_id, project_id, test_name, status) values ($1, $2, 't', 'passed')",
          [runId, aliceProject],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    await asCommitted(db, "service_role", null, (tx) =>
      tx.query(
        "insert into public.test_results (run_id, project_id, test_name, status) values ($1, $2, 'loads home', 'failed'), ($1, $2, 'loads home', 'passed'), ($1, $2, 'stable', 'passed')",
        [runId, aliceProject],
      ),
    );

    expect(await count("authenticated", alice, "test_results")).toBe(3);
    expect(await count("authenticated", bob, "test_results")).toBe(0);
  });

  it("flaky_tests lists tests that both passed and failed, respecting RLS", async () => {
    const aliceFlaky = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ test_name: string; failure_rate: string }>(
        "select test_name, failure_rate from public.flaky_tests",
      );
      return rows;
    });
    expect(aliceFlaky).toEqual([{ test_name: "loads home", failure_rate: "50.0" }]);
    expect(await count("authenticated", bob, "flaky_tests")).toBe(0);
  });

  it("run_daily_stats returns one row per day for the workspace only", async () => {
    const [aliceDays, bobTotal] = await Promise.all([
      as(db, "authenticated", alice, async (tx) => {
        const { rows } = await tx.query<{ total: number }>("select * from public.run_daily_stats($1, 7)", [aliceWs]);
        return rows;
      }),
      as(db, "authenticated", bob, async (tx) => {
        const { rows } = await tx.query<{ n: number }>(
          "select coalesce(sum(total), 0)::int as n from public.run_daily_stats($1, 7)",
          [aliceWs],
        );
        return rows[0]!.n;
      }),
    ]);
    expect(aliceDays).toHaveLength(7);
    expect(aliceDays.at(-1)!.total).toBeGreaterThan(0);
    expect(bobTotal).toBe(0);
  });

  it("issues cannot link to a test result from another project", async () => {
    const resultId = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select id from public.test_results limit 1");
      return rows[0]!.id;
    });

    await expect(
      as(db, "authenticated", bob, async (tx) => {
        const projectId = await insertProject(tx, bobWs, "B");
        await tx.query("insert into public.issues (project_id, test_result_id, title) values ($1, $2, 'steal')", [
          projectId,
          resultId,
        ]);
      }),
    ).rejects.toThrow(/issues_test_result_fk/);
  });
});

describe("cascades", () => {
  it("deleting a project removes its suites, cases, runs and results", async () => {
    const remaining = await as(db, "authenticated", alice, async (tx) => {
      await tx.query("delete from public.projects where id = $1", [aliceProject]);
      const q = async (t: string) =>
        (await tx.query<{ n: number }>(`select count(*)::int as n from public.${t}`)).rows[0]!.n;
      return [await q("test_suites"), await q("test_cases"), await q("test_runs"), await q("test_results")];
    });
    expect(remaining).toEqual([0, 0, 0, 0]);
  });

  it("members (non-admins) cannot delete projects", async () => {
    const affected = await as(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.workspace_invitations (workspace_id, email) values ($1, $2) returning id",
        [aliceWs, emailFor(bob)],
      );
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: bob, role: "authenticated", email: emailFor(bob) }),
      ]);
      await tx.query("select public.accept_invitation($1)", [rows[0]!.id]);
      const d = await tx.query("delete from public.projects where id = $1", [aliceProject]);
      return d.affectedRows;
    });
    expect(affected).toBe(0);
  });
});
