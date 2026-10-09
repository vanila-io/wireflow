import { getSponsors } from "@/lib/sponsors";

const TIER_META = {
  diamond: {
    title: "Diamond",
    rel: "noopener",
    card: "sm:col-span-2 p-5",
    logo: "h-14 w-14",
  },
  gold: {
    title: "Gold",
    rel: "noopener",
    card: "p-4",
    logo: "h-11 w-11",
  },
  silver: {
    title: "Silver",
    rel: "sponsored noopener",
    card: "p-4",
    logo: "h-10 w-10",
  },
  bronze: {
    title: "Bronze",
    rel: "nofollow noopener",
    card: "p-3",
    logo: "h-8 w-8",
  },
} as const;

export default async function Sponsors() {
  const tiers = await getSponsors();
  const hasAny =
    tiers.diamond.length +
      tiers.gold.length +
      tiers.silver.length +
      tiers.bronze.length >
    0;

  return (
    <section className="w-full bg-white py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink">
              Sponsors &amp; Backers
            </h2>
            <p className="mt-3 max-w-xl leading-7 text-ink-soft">
              Wireflow is free and open source thanks to our sponsors.
            </p>
          </div>
          <a
            href="https://opencollective.com/wireflow/contribute"
            target="_blank"
            rel="noopener"
            className="inline-block rounded-md bg-wire-blue px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue-dark"
          >
            Become a sponsor
          </a>
        </div>

        {hasAny ? (
          <div className="mt-10 space-y-8">
            {(["diamond", "gold", "silver", "bronze"] as const).map((tier) => {
              const sponsors = tiers[tier];
              if (sponsors.length === 0) return null;
              const meta = TIER_META[tier];
              return (
                <div key={tier}>
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                      {meta.title} sponsors
                    </h3>
                  </div>
                  <div
                    className={`mt-4 grid gap-4 ${
                      tier === "diamond" ? "sm:grid-cols-2" : "sm:grid-cols-3 lg:grid-cols-4"
                    }`}
                  >
                    {sponsors.map((s) => (
                      <a
                        key={s.name}
                        href={s.website ?? "https://opencollective.com/wireflow"}
                        target="_blank"
                        rel={meta.rel}
                        className={`flex items-center gap-3 rounded-xl bg-white shadow-sm ring-1 ring-wire-border transition hover:shadow-md hover:ring-wire-blue/50 ${meta.card}`}
                      >
                        {s.image ? (
                          <img
                            src={s.image}
                            alt={s.name}
                            className={`${meta.logo} rounded-lg object-contain`}
                          />
                        ) : (
                          <div
                            className={`${meta.logo} flex items-center justify-center rounded-lg bg-wire-lavender text-sm font-bold text-ink`}
                          >
                            {s.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-ink">
                            {s.name}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-xl bg-wire-lavender p-8 text-center text-sm text-ink-soft">
            No active sponsor packages right now — be the first.
          </div>
        )}
      </div>
    </section>
  );
}
