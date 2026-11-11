import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { databaseError, formValues, validationError } from "./action-state";

afterEach(() => vi.restoreAllMocks());

describe("databaseError", () => {
  it("maps a known unique violation to a field error", () => {
    const state = databaseError(
      { code: "23505", message: 'duplicate key value violates unique constraint "projects_owner_name_unique"' },
      { uniqueViolations: { projects_owner_name_unique: { field: "name", message: "Name taken" } } },
    );
    expect(state).toMatchObject({ status: "error", message: "Name taken", fieldErrors: { name: ["Name taken"] } });
  });

  it("maps permission errors without leaking details", () => {
    const state = databaseError({ code: "42501", message: 'new row violates row-level security policy for table "projects"' });
    expect(state).toEqual({ status: "error", message: "You don't have permission to do that.", values: undefined });
  });

  it("hides unknown errors behind a generic message and logs them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = databaseError({ code: "XX000", message: "internal: connection to 10.0.0.3 failed" });
    expect(state.status === "error" && state.message).toBe("Something went wrong. Please try again.");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("validationError", () => {
  it("returns flattened field errors and echoes submitted values", () => {
    const schema = z.object({ name: z.string().min(1, "Required") });
    const result = schema.safeParse({ name: "" });
    expect(validationError(result.error!, { name: "" })).toEqual({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { name: ["Required"] },
      values: { name: "" },
    });
  });
});

describe("formValues", () => {
  it("reads string fields and defaults missing/file fields to empty", () => {
    const fd = new FormData();
    fd.set("name", "Shop");
    fd.set("file", new Blob(["x"]));
    expect(formValues(fd, ["name", "file", "missing"] as const)).toEqual({ name: "Shop", file: "", missing: "" });
  });
});
