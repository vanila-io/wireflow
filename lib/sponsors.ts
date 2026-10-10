import { unavailable } from "./remote-data";

export const OC_MEMBERS_URL = "https://opencollective.com/wireflow/members/all.json?limit=200";

export type Sponsor = {
  name: string;
  website: string | null;
  image: string | null;
  tier: "diamond" | "gold" | "silver" | "bronze";
  totalAmountDonated: number;
  isActive: boolean;
};

export type TieredSponsors = {
  diamond: Sponsor[];
  gold: Sponsor[];
  silver: Sponsor[];
  bronze: Sponsor[];
};

export type OcMember = {
  role: string;
  tier?: string | null;
  isActive: boolean;
  totalAmountDonated: number;
  profile: string;
  name: string;
  website: string | null;
  image: string | null;
};

const TIER_PREFIXES: Array<[string, Sponsor["tier"]]> = [
  ["Diamond Tier", "diamond"],
  ["Gold Tier", "gold"],
  ["Silver Tier", "silver"],
  ["Bronze Tier", "bronze"],
];

// A member must have donated at least one month of their tier's price
// to be shown. Without this, accounts that picked a tier but only ever
// paid a $1-5 one-off (the old site's bug) appear as sponsors.
const MIN_TIER_TOTAL: Record<Sponsor["tier"], number> = {
  diamond: 99,
  gold: 59,
  silver: 36,
  bronze: 19,
};

function tierOf(tierName?: string | null): Sponsor["tier"] | null {
  if (!tierName) return null;
  for (const [prefix, tier] of TIER_PREFIXES) {
    if (tierName.startsWith(prefix)) return tier;
  }
  return null;
}

const emptyTiers = (): TieredSponsors => ({ diamond: [], gold: [], silver: [], bronze: [] });

/** Current, paid tier members, by tier, largest total first. */
export function tierSponsors(members: OcMember[]): TieredSponsors {
  const tiers = emptyTiers();
  const seen = new Set<string>();
  const tiered: Sponsor[] = [];

  for (const m of members) {
    // Only paid tier members. This is the fix for the old bug: the
    // previous script pulled every BACKER row, which surfaced $1-3
    // one-off donors with no package as "sponsors".
    const tier = tierOf(m.tier);
    if (m.role !== "BACKER" || !tier) continue;
    // Only CURRENT sponsors: an active subscription or an annual
    // package that hasn't expired. Expired backers don't display.
    if (!m.isActive) continue;
    if (m.totalAmountDonated < MIN_TIER_TOTAL[tier]) continue;
    // Dedupe (same account can appear once per tier change).
    if (seen.has(m.profile)) continue;
    seen.add(m.profile);
    tiered.push({
      name: m.name,
      website: m.website || m.profile,
      image: m.image,
      tier,
      totalAmountDonated: m.totalAmountDonated,
      isActive: m.isActive,
    });
  }

  for (const tier of ["diamond", "gold", "silver", "bronze"] as const) {
    tiers[tier] = tiered
      .filter((s) => s.tier === tier)
      .sort((a, b) => b.totalAmountDonated - a.totalAmountDonated);
  }
  return tiers;
}

// Fetched on the server when "/" is generated (at build, then at most hourly),
// never from the visitor's browser. If Open Collective can't be read, see
// lib/remote-data.ts: a build lists no sponsors, a later regeneration keeps
// the last page that listed them.
export async function getSponsors(fetcher: typeof fetch = fetch): Promise<TieredSponsors> {
  try {
    const res = await fetcher(OC_MEMBERS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Open Collective answered ${res.status}`);
    const members: unknown = await res.json();
    if (!Array.isArray(members)) throw new Error("Open Collective answered without a member list");
    return tierSponsors(members as OcMember[]);
  } catch (error) {
    return unavailable(emptyTiers(), `Sponsors: ${(error as Error).message}`);
  }
}
