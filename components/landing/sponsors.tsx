import { ArrowUpRight } from "lucide-react";
import type { Sponsor, TieredSponsors } from "@/lib/sponsors";
import { Button, container, label, sectionTitle } from "./ui";

// rel per tier is what each Open Collective package promises (dofollow, sponsored, nofollow).
const TIER_META = {
  diamond: { title: "Diamond", rel: "noopener", grid: "sm:grid-cols-2", logo: 56 },
  gold: { title: "Gold", rel: "noopener", grid: "sm:grid-cols-2 lg:grid-cols-4", logo: 44 },
  silver: { title: "Silver", rel: "sponsored noopener", grid: "sm:grid-cols-2 lg:grid-cols-4", logo: 40 },
  bronze: { title: "Bronze", rel: "nofollow noopener", grid: "grid-cols-2 lg:grid-cols-4", logo: 32 },
} as const;

function SponsorCard({ sponsor, tier }: { sponsor: Sponsor; tier: keyof typeof TIER_META }) {
  const meta = TIER_META[tier];
  const size = { width: meta.logo, height: meta.logo };
  return (
    <a
      href={sponsor.website ?? "https://opencollective.com/wireflow"}
      target="_blank"
      rel={meta.rel}
      className="group flex items-center gap-3 rounded-2xl border border-wire-border bg-white p-3.5 transition hover:border-wire-blue/30 hover:shadow-[0_16px_36px_-22px_rgba(27,26,31,0.4)]"
    >
      {sponsor.image ? (
        // Any https host: Open Collective serves avatars from several (lib/security.ts allows https images).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsor.image}
          // The name next to it names the link.
          alt=""
          {...size}
          loading="lazy"
          decoding="async"
          className="shrink-0 rounded-xl object-contain"
          style={size}
        />
      ) : (
        <span
          className="flex shrink-0 items-center justify-center rounded-xl bg-wire-canvas text-sm font-semibold text-ink"
          style={size}
          aria-hidden
        >
          {sponsor.name.charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{sponsor.name}</span>
      <ArrowUpRight size={16} className="shrink-0 text-ink-soft group-hover:text-ink" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default function Sponsors({ tiers }: { tiers: TieredSponsors }) {
  const order = ["diamond", "gold", "silver", "bronze"] as const;
  const hasAny = order.some((t) => tiers[t].length > 0);

  return (
    <section id="sponsors" aria-labelledby="sponsors-title" className="bg-wire-canvas py-16 sm:py-24">
      <div className={container}>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h2 id="sponsors-title" className={sectionTitle}>
              Sponsors &amp; Backers
            </h2>
            <p className="mt-4 max-w-xl text-[17px] leading-[1.65] text-ink-soft">
              Wireflow is free and open source thanks to our sponsors.
            </p>
          </div>
          <Button href="https://opencollective.com/wireflow/contribute" newTab rel="noopener">
            Become a sponsor
          </Button>
        </div>

        {hasAny ? (
          <div className="mt-12 space-y-10">
            {order.map((tier) => {
              const sponsors = tiers[tier];
              if (sponsors.length === 0) return null;
              const meta = TIER_META[tier];
              return (
                <div key={tier}>
                  <h3 className={label}>{meta.title} sponsors</h3>
                  <ul className={`mt-4 grid gap-3 ${meta.grid}`}>
                    {sponsors.map((s) => (
                      <li key={s.name}>
                        <SponsorCard sponsor={s} tier={tier} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-12 rounded-2xl border border-dashed border-wire-border bg-white/60 p-8 text-center text-sm text-ink-soft">
            No active sponsor packages right now — be the first.
          </p>
        )}
      </div>
    </section>
  );
}
