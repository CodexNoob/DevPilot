import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF defence for the browser the worker drives. Project URLs are checked
 * when saved, but DNS can change (rebinding) and pages can request anything,
 * so every request is re-checked against the *resolved* addresses here.
 */

type V4Range = [base: number, bits: number];

const ipv4ToInt = (ip: string): number =>
  ip.split(".").reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);

const v4 = (cidr: string): V4Range => {
  const [base, bits] = cidr.split("/");
  return [ipv4ToInt(base!), Number(bits)];
};

const BLOCKED_V4: V4Range[] = [
  "0.0.0.0/8", // "this" network
  "10.0.0.0/8", // private
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local, incl. cloud metadata 169.254.169.254
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // documentation
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // documentation
  "203.0.113.0/24", // documentation
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved, incl. broadcast
].map(v4);

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (base & mask);
  });
}

/** Expands an IPv6 address into 8 16-bit groups (handles "::" and trailing dotted IPv4). */
function ipv6Groups(ip: string): number[] | null {
  let address = ip.toLowerCase().split("%")[0]!; // drop zone id
  const dotted = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = ipv4ToInt(dotted[1]!);
    address = address.slice(0, -dotted[1]!.length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = address.split("::");
  const parse = (part: string | undefined) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const headGroups = parse(head);
  const tailGroups = parse(tail);
  if (address.includes("::")) {
    const missing = 8 - headGroups.length - tailGroups.length;
    if (missing < 0) return null;
    return [...headGroups, ...Array(missing).fill(0), ...tailGroups];
  }
  return headGroups.length === 8 ? headGroups : null;
}

const groupsToV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

function isBlockedV6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (!g || g.some((n) => Number.isNaN(n))) return true; // unparsable: refuse

  const allZeroPrefix = (count: number) => g.slice(0, count).every((n) => n === 0);
  if (allZeroPrefix(8)) return true; // ::
  if (allZeroPrefix(7) && g[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): judge the embedded IPv4.
  if (allZeroPrefix(5) && g[5] === 0xffff) return isBlockedV4(groupsToV4(g[6]!, g[7]!));
  if (allZeroPrefix(6)) return isBlockedV4(groupsToV4(g[6]!, g[7]!));
  // NAT64 well-known prefix 64:ff9b::/96 embeds an IPv4 address.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) {
    return isBlockedV4(groupsToV4(g[6]!, g[7]!));
  }
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0]! & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

/** True for addresses the worker must never connect to. Non-IP input is treated as blocked. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedV4(ip);
  if (version === 6) return isBlockedV6(ip);
  return true;
}

export type GuardResult = { allowed: true } | { allowed: false; reason: string };

type Lookup = (hostname: string) => Promise<{ address: string }[]>;

const defaultLookup: Lookup = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Creates a per-run checker with a DNS cache. `data:` and `blob:` URLs are
 * allowed (they never hit the network); other non-http(s) schemes are not.
 */
export function createNetworkGuard(lookup: Lookup = defaultLookup) {
  const cache = new Map<string, Promise<GuardResult>>();

  const checkHost = (hostname: string): Promise<GuardResult> => {
    const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    let pending = cache.get(host);
    if (!pending) {
      pending = (async (): Promise<GuardResult> => {
        if (isIP(host)) {
          return isBlockedAddress(host) ? { allowed: false, reason: `Blocked address ${host}` } : { allowed: true };
        }
        try {
          const addresses = await lookup(host);
          if (addresses.length === 0) return { allowed: false, reason: `${host} did not resolve` };
          const blocked = addresses.find((a) => isBlockedAddress(a.address));
          return blocked
            ? { allowed: false, reason: `${host} resolves to blocked address ${blocked.address}` }
            : { allowed: true };
        } catch {
          return { allowed: false, reason: `${host} could not be resolved` };
        }
      })();
      cache.set(host, pending);
    }
    return pending;
  };

  return {
    async check(rawUrl: string): Promise<GuardResult> {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return { allowed: false, reason: "Invalid URL" };
      }
      if (url.protocol === "data:" || url.protocol === "blob:") return { allowed: true };
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { allowed: false, reason: `Scheme ${url.protocol} is not allowed` };
      }
      return checkHost(url.hostname);
    },
  };
}

export type NetworkGuard = ReturnType<typeof createNetworkGuard>;

export type ResolvedUrl = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Resolves a `goto` path against the project's base URL. Absolute URLs are
 * allowed only on the same origin, so a test can't be pointed elsewhere.
 */
export function resolveGotoUrl(baseUrl: string, path: string): ResolvedUrl {
  let base: URL;
  let target: URL;
  try {
    base = new URL(baseUrl);
    target = new URL(path, base.href.endsWith("/") ? base.href : `${base.href}/`);
  } catch {
    return { ok: false, reason: `Invalid path ${path}` };
  }
  // Relative paths starting with "/" are root-relative; keep the base's path prefix only for "?"/"#".
  if (path.startsWith("/")) target = new URL(path, base.origin);
  if (target.origin !== base.origin) {
    return { ok: false, reason: `${target.origin} is outside the project (${base.origin})` };
  }
  return { ok: true, url: target.toString() };
}
