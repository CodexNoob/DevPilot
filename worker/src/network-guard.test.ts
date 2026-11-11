import { describe, expect, it } from "vitest";
import { createNetworkGuard, isBlockedAddress, resolveGotoUrl } from "./network-guard";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("createNetworkGuard", () => {
  const lookup = async (host: string) => {
    if (host === "rebind.example.com") return [{ address: "93.184.216.34" }, { address: "10.0.0.5" }];
    if (host === "public.example.com") return [{ address: "93.184.216.34" }];
    throw new Error("ENOTFOUND");
  };

  it("checks resolved addresses, IP literals and schemes", async () => {
    const guard = createNetworkGuard(lookup);
    expect(await guard.check("https://public.example.com/a")).toEqual({ allowed: true });
    expect((await guard.check("https://rebind.example.com/")).allowed).toBe(false);
    expect((await guard.check("http://127.0.0.1:8080/")).allowed).toBe(false);
    expect((await guard.check("http://[::1]/")).allowed).toBe(false);
    expect((await guard.check("https://nope.invalid/")).allowed).toBe(false);
    expect((await guard.check("file:///etc/passwd")).allowed).toBe(false);
    expect(await guard.check("data:text/plain,hi")).toEqual({ allowed: true });
  });

  it("caches lookups per host", async () => {
    let calls = 0;
    const guard = createNetworkGuard(async () => {
      calls++;
      return [{ address: "93.184.216.34" }];
    });
    await guard.check("https://a.example.com/1");
    await guard.check("https://a.example.com/2");
    expect(calls).toBe(1);
  });
});

describe("resolveGotoUrl", () => {
  it("resolves root-relative paths against the origin", () => {
    expect(resolveGotoUrl("https://shop.example.com/app", "/checkout")).toEqual({
      ok: true,
      url: "https://shop.example.com/checkout",
    });
  });

  it("allows same-origin absolute URLs and query-only paths", () => {
    expect(resolveGotoUrl("https://shop.example.com", "https://shop.example.com/a?b=1")).toEqual({
      ok: true,
      url: "https://shop.example.com/a?b=1",
    });
    expect(resolveGotoUrl("https://shop.example.com", "?q=shoes").ok).toBe(true);
  });

  it("rejects other origins, including scheme and port changes", () => {
    expect(resolveGotoUrl("https://shop.example.com", "https://evil.example.com/").ok).toBe(false);
    expect(resolveGotoUrl("https://shop.example.com", "http://shop.example.com/").ok).toBe(false);
    expect(resolveGotoUrl("https://shop.example.com", "https://shop.example.com:8443/").ok).toBe(false);
    expect(resolveGotoUrl("https://shop.example.com", "//evil.example.com/x").ok).toBe(false);
  });
});
