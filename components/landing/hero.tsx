import Link from "next/link";

function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="40"
      viewBox="0 0 24 40"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 2v30M12 32l-5.5-6.5M12 32l5.5-6.5"
        stroke="#A3A8C3"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroMockup() {
  return (
    <div className="relative rounded-xl bg-white shadow-[0_30px_80px_-20px_rgba(45,43,51,0.35)] ring-1 ring-wire-border">
      <div className="flex items-center gap-1.5 rounded-t-xl bg-ink px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 h-2 w-24 rounded-full bg-white/20" />
      </div>
      <div className="grid w-[560px] max-w-full grid-cols-2 gap-10 bg-wire-canvas/60 px-8 py-8 max-lg:w-[480px]">
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/graphics/header/header-1.svg"
            alt="Header wireframe card"
            width={220}
            className="w-[200px] rounded-lg shadow-md"
          />
          <Arrow className="my-1" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/graphics/sign-in/sign-in-1.svg"
            alt="Sign in wireframe card"
            width={220}
            className="w-[220px] rounded-lg shadow-md"
          />
        </div>
        <div className="flex flex-col items-center pt-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/graphics/article/article-1.svg"
            alt="Article wireframe card"
            width={220}
            className="w-[220px] rounded-lg shadow-md"
          />
          <Arrow className="my-1" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/graphics/e-commerce/checkout.svg"
            alt="Checkout wireframe card"
            width={220}
            className="w-[220px] rounded-lg shadow-md"
          />
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-ink">
          Free Wire /<br />
          User Flow Tool
        </h1>
        <p className="mt-6 max-w-md text-lg leading-8 text-ink-soft">
          Wireflow is a <strong className="font-semibold text-ink">free, online and open source tool</strong>{" "}
          for creating beautiful user flow prototypes.{" "}
          <strong className="font-semibold text-ink">No Photoshop</strong> skills required!
        </p>
        <div className="mt-8">
          <Link
            href="/app"
            className="inline-block rounded-md bg-wire-blue px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-wire-blue/25 transition hover:bg-wire-blue-dark"
          >
            Start designing
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Free forever. No sign up needed.
        </p>
      </div>
      <HeroMockup />
    </section>
  );
}
