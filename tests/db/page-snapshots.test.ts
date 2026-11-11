import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, asCommitted, createTestDatabase, createUser, personalWorkspace } from "./harness";

describe("page_snapshots", () => {
  let db: PGlite;
  let alice: string;
  let bob: string;
  let project: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db, "Alice");
    bob = await createUser(db);
    const workspace = await personalWorkspace(db, alice);
    project = await asCommitted(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.projects (workspace_id, name, base_url) values ($1, 'Shop', 'https://shop.example.com') returning id",
        [workspace],
      );
      return rows[0]!.id;
    });
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const request = (user: string, extra = "", values: unknown[] = []) =>
    as(db, "authenticated", user, async (tx) => {
      const { rows } = await tx.query<{ status: string; requested_by: string }>(
        `insert into public.page_snapshots (project_id, path${extra ? `, ${extra}` : ""})
         values ($1, '/cart'${values.map((_, i) => `, $${i + 2}`).join("")}) returning status, requested_by`,
        [project, ...values],
      );
      return rows[0]!;
    });

  it("lets project members request a capture, recorded as theirs", async () => {
    const row = await request(alice);
    expect(row.status).toBe("queued");
    expect(row.requested_by).toBe(alice);
  });

  it("rejects requests for projects outside the user's workspaces", async () => {
    await expect(request(bob)).rejects.toThrow(/row-level security/);
  });

  it("rejects fabricated results and other users as requester", async () => {
    await expect(request(alice, "status", ["done"])).rejects.toThrow(/row-level security/);
    await expect(request(alice, "snapshot", [JSON.stringify({ title: "fake" })])).rejects.toThrow(/row-level security/);
    await expect(request(alice, "requested_by", [bob])).rejects.toThrow(/row-level security|foreign key/);
  });

  it("rejects paths that are not root-relative", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) =>
        tx.query("insert into public.page_snapshots (project_id, path) values ($1, 'https://evil.example.com/')", [project]),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("does not let users mark a capture done or read other workspaces' captures", async () => {
    const id = await asCommitted(db, "authenticated", alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.page_snapshots (project_id, path) values ($1, '/') returning id",
        [project],
      );
      return rows[0]!.id;
    });

    const updated = await as(db, "authenticated", alice, async (tx) => {
      const { affectedRows } = await tx.query("update public.page_snapshots set status = 'done' where id = $1", [id]);
      return affectedRows;
    });
    expect(updated).toBe(0);

    const visibleToBob = await as(db, "authenticated", bob, async (tx) => {
      const { rows } = await tx.query("select id from public.page_snapshots where id = $1", [id]);
      return rows.length;
    });
    expect(visibleToBob).toBe(0);
  });

  it("only the worker can claim captures", async () => {
    await expect(
      as(db, "authenticated", alice, (tx) => tx.query("select * from public.claim_next_page_snapshot()")),
    ).rejects.toThrow(/permission denied/);

    const claimed = await as(db, "service_role", null, async (tx) => {
      const { rows } = await tx.query<{ status: string; started_at: string | null }>(
        "select * from public.claim_next_page_snapshot()",
      );
      return rows;
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.status).toBe("running");
    expect(claimed[0]!.started_at).not.toBeNull();
  });

  it("anonymous users have no access", async () => {
    await expect(
      as(db, "anon", null, (tx) => tx.query("select * from public.page_snapshots")),
    ).rejects.toThrow(/permission denied/);
  });
});
