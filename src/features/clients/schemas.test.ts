import { describe, expect, it } from "vitest";
import { clientInputSchema } from "./schemas";

describe("clientInputSchema", () => {
  it("trims, lower-cases email and nulls empty optionals", () => {
    expect(clientInputSchema.parse({ name: " Acme ", contactEmail: " Ops@Acme.COM ", notes: "" })).toEqual({
      name: "Acme",
      contactEmail: "ops@acme.com",
      notes: null,
    });
    expect(clientInputSchema.parse({ name: "Acme", contactEmail: "", notes: " " }).contactEmail).toBeNull();
  });

  it("rejects missing name and bad email", () => {
    const result = clientInputSchema.safeParse({ name: " ", contactEmail: "nope", notes: "" });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path[0])).toEqual(["name", "contactEmail"]);
  });
});
