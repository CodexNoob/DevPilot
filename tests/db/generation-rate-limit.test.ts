import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDatabase, createUser } from "./harness";

describe("generation rate limit RPC", () => {
  let db: PGlite;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    userId = await createUser(db);
    otherUserId = await createUser(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it("allows ten requests per user, then returns a retry delay", async () => {
    const results = await as(db, "authenticated", userId, async (tx) => {
      const allowed: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        const { rows } = await tx.query<{ allowed: boolean; retry_after_ms: number }>(
          "select * from public.take_generation_rate_limit()",
        );
        allowed.push(rows[0]!.allowed);
      }
      const { rows } = await tx.query<{ allowed: boolean; retry_after_ms: number }>(
        "select * from public.take_generation_rate_limit()",
      );
      return { allowed, denied: rows[0]! };
    });

    expect(results.allowed).toEqual(Array(10).fill(true));
    expect(results.denied.allowed).toBe(false);
    expect(results.denied.retry_after_ms).toBeGreaterThan(0);
    expect(results.denied.retry_after_ms).toBeLessThanOrEqual(10 * 60_000);
  });

  it("keeps quotas separate for different users", async () => {
    const result = await as(db, "authenticated", otherUserId, async (tx) => {
      const { rows } = await tx.query<{ allowed: boolean }>(
        "select * from public.take_generation_rate_limit()",
      );
      return rows[0]!.allowed;
    });
    expect(result).toBe(true);
  });

  it("does not expose limiter rows to API roles", async () => {
    await expect(
      as(db, "authenticated", userId, async (tx) => tx.query("select * from public.generation_rate_limits")),
    ).rejects.toThrow();
  });

  it("rejects anonymous calls", async () => {
    await expect(
      as(db, "anon", null, async (tx) => tx.query("select * from public.take_generation_rate_limit()")),
    ).rejects.toThrow();
  });
});
