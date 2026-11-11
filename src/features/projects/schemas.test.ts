import { describe, expect, it } from "vitest";
import { parseBaseUrl, projectInputSchema, suiteInputSchema } from "./schemas";

describe("parseBaseUrl", () => {
  it.each([
    ["example.com", "https://example.com"],
    ["https://example.com/", "https://example.com"],
    ["  http://shop.example.com  ", "http://shop.example.com"],
    ["https://example.com/app/?env=stg#top", "https://example.com/app/?env=stg"],
    ["HTTPS://Example.COM", "https://example.com"],
    ["https://example.com:8443", "https://example.com:8443"],
  ])("accepts %j as %j", (input, expected) => {
    expect(parseBaseUrl(input)).toEqual({ ok: true, url: expected });
  });

  it.each([
    ["", /required/],
    ["javascript:alert(1)", /http and https/],
    ["ftp://example.com", /http and https/],
    ["file:///etc/passwd", /http and https/],
    ["https://user:pass@example.com", /credentials/],
    ["https://intranet", /public hostname/],
    ["http://localhost:3000", /public hostname/],
    ["http://127.0.0.1", /Private/],
    ["http://2130706433", /Private/], // decimal form of 127.0.0.1
    ["http://0x7f.0.0.1", /Private/], // hex form of 127.0.0.1
    ["http://10.0.0.5", /Private/],
    ["http://172.20.1.1", /Private/],
    ["http://192.168.1.1", /Private/],
    ["http://169.254.169.254/latest/meta-data", /Private/], // cloud metadata
    ["http://100.100.1.1", /Private/],
    ["http://[::1]", /Private/],
    ["http://[::ffff:127.0.0.1]", /Private/],
    ["http://[fd12:3456::1]", /Private/],
    ["http://app.localhost", /Private/],
    ["http://printer.local", /Private/],
    ["https://" + "a".repeat(2050) + ".com", /too long/],
  ])("rejects %j", (input, reason) => {
    const result = parseBaseUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(reason);
  });

  it("allows public IPs and does not over-match private prefixes", () => {
    expect(parseBaseUrl("http://172.32.0.1").ok).toBe(true);
    expect(parseBaseUrl("http://8.8.8.8").ok).toBe(true);
    expect(parseBaseUrl("http://100.128.0.1").ok).toBe(true);
  });
});

describe("projectInputSchema", () => {
  const valid = { name: " Storefront ", description: "", baseUrl: "shop.example.com", environment: "staging" };

  it("trims, normalises the URL and turns empty description into null", () => {
    expect(projectInputSchema.parse(valid)).toEqual({
      name: "Storefront",
      description: null,
      baseUrl: "https://shop.example.com",
      environment: "staging",
      clientId: null,
    });
  });

  it("accepts a client id or empty, rejects garbage", () => {
    const id = "6f1c3c1e-6d3b-4c55-9b2e-6f9f0d7a1b23";
    expect(projectInputSchema.parse({ ...valid, clientId: id }).clientId).toBe(id);
    expect(projectInputSchema.parse({ ...valid, clientId: "" }).clientId).toBeNull();
    expect(projectInputSchema.safeParse({ ...valid, clientId: "acme" }).success).toBe(false);
  });

  it("reports field-level errors", () => {
    const result = projectInputSchema.safeParse({
      name: "   ",
      description: "x".repeat(1001),
      baseUrl: "http://localhost",
      environment: "qa",
    });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "description", "baseUrl", "environment"]));
  });
});

describe("suiteInputSchema", () => {
  it("requires a name and caps its length", () => {
    expect(suiteInputSchema.safeParse({ name: "", description: "" }).success).toBe(false);
    expect(suiteInputSchema.safeParse({ name: "x".repeat(101), description: "" }).success).toBe(false);
    expect(suiteInputSchema.parse({ name: "Smoke", description: " " })).toEqual({ name: "Smoke", description: null });
  });
});
