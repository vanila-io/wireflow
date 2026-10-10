import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL, fetchStars, formatCount, getStars } from "@/lib/github";
import { RemoteDataError, unavailable } from "@/lib/remote-data";
import { getSponsors, OC_MEMBERS_URL, tierSponsors, type OcMember } from "@/lib/sponsors";

const json = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const failing = vi.fn(async () => {
  throw new TypeError("fetch failed");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("unavailable (what the landing does when GitHub or Open Collective can't be read)", () => {
  it("uses the fallback during next build, so the build never fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(unavailable(null, "x", { NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBeNull();
  });

  it("throws during a background regeneration, so Next.js keeps the last good page", () => {
    expect(() => unavailable(null, "GitHub API answered 403", { NODE_ENV: "production" })).toThrow(RemoteDataError);
  });

  it("uses the fallback in development and tests", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(unavailable([], "x", { NODE_ENV: "development" })).toEqual([]);
  });
});

describe("GitHub stars", () => {
  it("reads stargazers_count from the repository API, with a User-Agent and hourly revalidation", async () => {
    const fetcher = json({ stargazers_count: 4167, forks_count: 395 });
    expect(await fetchStars(fetcher as unknown as typeof fetch)).toBe(4167);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit & { next: { revalidate: number } }];
    expect(url).toBe(API_URL);
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/wireflow/);
    expect(init.next.revalidate).toBe(3600);
  });

  it("hides the number (null) when GitHub is rate-limited, unreachable or answers nonsense", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "test");
    expect(await getStars(json({ message: "API rate limit exceeded" }, 403) as unknown as typeof fetch)).toBeNull();
    expect(await getStars(failing as unknown as typeof fetch)).toBeNull();
    expect(await getStars(json({ stargazers_count: "lots" }) as unknown as typeof fetch)).toBeNull();
  });

  it("keeps the last page when regeneration can't read it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    await expect(getStars(json({}, 403) as unknown as typeof fetch)).rejects.toThrow(RemoteDataError);
  });

  it("formats the count with thousands separators", () => {
    expect(formatCount(4167)).toBe("4,167");
    expect(formatCount(12)).toBe("12");
  });
});

const member = (over: Partial<OcMember>): OcMember => ({
  role: "BACKER",
  tier: "Gold Tier - Dofollow backlink",
  isActive: true,
  totalAmountDonated: 177,
  profile: "https://opencollective.com/x",
  name: "X",
  website: "https://x.example",
  image: null,
  ...over,
});

describe("sponsors", () => {
  it("lists only current, paid tier members, deduplicated and largest first", () => {
    const tiers = tierSponsors([
      member({ name: "BuyVPS", profile: "p1", totalAmountDonated: 177 }),
      member({ name: "Netrouting", profile: "p2", totalAmountDonated: 354 }),
      member({ name: "Netrouting again", profile: "p2", totalAmountDonated: 354 }),
      member({ name: "Expired", profile: "p3", isActive: false }),
      member({ name: "One-off $4", profile: "p4", totalAmountDonated: 4 }),
      member({ name: "No tier", profile: "p5", tier: null }),
      member({ name: "Admin", profile: "p6", role: "ADMIN" }),
      member({ name: "UnAIMyText", profile: "p7", tier: "Silver Tier - Sponspored rel", totalAmountDonated: 360 }),
      member({ name: "Bronze", profile: "p8", tier: "Bronze Tier - Nofollow rel", totalAmountDonated: 19, website: null }),
    ]);
    expect(tiers.gold.map((s) => s.name)).toEqual(["Netrouting", "BuyVPS"]);
    expect(tiers.silver.map((s) => s.name)).toEqual(["UnAIMyText"]);
    expect(tiers.bronze.map((s) => s.website)).toEqual(["p8"]);
    expect(tiers.diamond).toEqual([]);
  });

  it("fetches Open Collective's member list with hourly revalidation", async () => {
    const fetcher = json([member({ name: "BuyVPS" })]);
    const tiers = await getSponsors(fetcher as unknown as typeof fetch);
    expect(tiers.gold.map((s) => s.name)).toEqual(["BuyVPS"]);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, { next: { revalidate: number } }];
    expect(url).toBe(OC_MEMBERS_URL);
    expect(init.next.revalidate).toBe(3600);
  });

  it("shows no sponsors when Open Collective can't be read during a build, and keeps the last page after it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(await getSponsors(failing as unknown as typeof fetch)).toEqual({ diamond: [], gold: [], silver: [], bronze: [] });
    vi.stubEnv("NEXT_PHASE", "");
    await expect(getSponsors(json({ error: "nope" }) as unknown as typeof fetch)).rejects.toThrow(RemoteDataError);
  });
});
