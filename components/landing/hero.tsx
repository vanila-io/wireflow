import { Star } from "lucide-react";
import { formatCount, REPO_URL } from "@/lib/github";
import HeroScene from "./anim/hero-scene";
import PlayWhenVisible from "./anim/play-when-visible";
import { Button, container } from "./ui";

// The live star count (null when GitHub couldn't be read: the line then says
// "Open source on GitHub" without a number).
function StarLine({ stars }: { stars: number | null }) {
  return (
    <a
      href={REPO_URL}
      className="inline-flex items-center gap-2 rounded-md text-sm text-ink-soft transition-colors hover:text-ink"
      data-testid="hero-stars"
    >
      <Star size={16} className="fill-amber-400 text-amber-500" aria-hidden />
      {stars === null ? (
        <span>Open source on GitHub</span>
      ) : (
        <span>
          <strong className="font-semibold text-ink">{formatCount(stars)}</strong> stars on GitHub
        </span>
      )}
    </a>
  );
}

// The editor, animated (anim/hero-scene.tsx), framed on the wire-blue wash.
// Phones get a closer view of the canvas instead of the whole (tiny) window.
// Both SVGs have a fixed aspect ratio, so nothing moves when the page loads.
function ProductShot() {
  return (
    <div className="landing-aura relative mt-12 aspect-square overflow-hidden rounded-[24px] pl-5 pt-5 sm:mt-16 sm:aspect-[16/10] sm:rounded-[28px] sm:pl-10 sm:pt-10 lg:pl-14 lg:pt-14">
      <PlayWhenVisible
        testId="hero-animation"
        className="overflow-hidden rounded-tl-[14px] bg-white shadow-[0_30px_80px_-30px_rgba(27,26,31,0.55)] ring-1 ring-black/5"
      >
        <HeroScene />
      </PlayWhenVisible>
    </div>
  );
}

export default function Hero({ stars }: { stars: number | null }) {
  return (
    <section aria-labelledby="hero-title" className="pt-10 sm:pt-16 lg:pt-20">
      <div className={container}>
        <h1
          id="hero-title"
          className="text-[44px] font-medium leading-[1.04] tracking-[-0.04em] text-ink sm:text-[56px] lg:text-[64px]"
        >
          Free Wire /<br />
          User Flow Tool
        </h1>
        <p className="mt-5 max-w-[34rem] text-[17px] leading-[1.65] text-ink-soft sm:text-lg">
          Wireflow is a <strong className="font-medium text-ink">free, online and open source tool</strong>{" "}
          for creating beautiful user flow prototypes.{" "}
          <strong className="font-medium text-ink">No Photoshop</strong> skills required!
        </p>
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Button href="/app">Start designing</Button>
          <p className="text-sm text-ink-soft">Free forever. No sign up needed.</p>
        </div>
        <div className="mt-6">
          <StarLine stars={stars} />
        </div>
        <ProductShot />
      </div>
    </section>
  );
}
