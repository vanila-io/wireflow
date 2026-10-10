import Header from "@/components/landing/header";
import Hero from "@/components/landing/hero";
import Features from "@/components/landing/features";
import Gallery from "@/components/landing/gallery";
import OpenSource from "@/components/landing/open-source";
import Sponsors from "@/components/landing/sponsors";
import Footer from "@/components/landing/footer";
import { getStars } from "@/lib/github";
import { getSponsors } from "@/lib/sponsors";

// Prerendered at build, then regenerated in the background at most once an
// hour, so the GitHub star count and the sponsors stay current without a
// request to either site per visit (lib/github.ts, lib/sponsors.ts).
export const revalidate = 3600;

export default async function Home() {
  const [stars, sponsors] = await Promise.all([getStars(), getSponsors()]);
  return (
    <div className="landing flex min-h-screen flex-col bg-white text-ink">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-wire-blue px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Hero stars={stars} />
        <Features />
        <Gallery />
        <OpenSource stars={stars} />
        <Sponsors tiers={sponsors} />
      </main>
      <Footer />
    </div>
  );
}
