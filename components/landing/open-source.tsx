import Image from "next/image";
import { Check, Star } from "lucide-react";
import { formatCount, REPO, REPO_URL } from "@/lib/github";
import { Button, container, GitHubMark, sectionTitle } from "./ui";

const techs = [
  {
    name: "Node.js",
    text: "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine, using an event-driven, non-blocking I/O model.",
  },
  {
    name: "Next.js",
    text: "Next.js is a React framework that gives you building blocks to create fast, full-stack web applications.",
  },
  {
    name: "React.js",
    text: "React is a declarative, efficient and flexible JavaScript library for building user interfaces.",
  },
];

// The repository at a glance: its live star count (left out when GitHub
// couldn't be read) and its licence.
function RepoCard({ stars }: { stars: number | null }) {
  return (
    <div className="relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-[28px] bg-ink p-8 text-white sm:min-h-[420px] sm:p-10">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-wire-blue/40 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
          <Image src="/wireflow-logo.png" alt="Wireflow logo" width={30} height={30} />
        </span>
        <span className="flex items-center gap-2 font-mono text-sm text-white/75">
          <GitHubMark size={16} />
          {REPO}
        </span>
      </div>
      <div className="relative" data-testid="repo-stars">
        {stars === null ? (
          <p className="text-[40px] font-medium leading-none tracking-[-0.03em]">Open source</p>
        ) : (
          <>
            <p className="flex items-center gap-3 text-[56px] font-medium leading-none tracking-[-0.04em] sm:text-[72px]">
              <Star className="h-10 w-10 fill-amber-400 text-amber-400 sm:h-12 sm:w-12" aria-hidden />
              {formatCount(stars)}
            </p>
            <p className="mt-3 text-sm uppercase tracking-[0.12em] text-white/65">stars on GitHub</p>
          </>
        )}
      </div>
      <p className="relative inline-flex w-fit rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white/80">
        MIT licensed
      </p>
    </div>
  );
}

export default function OpenSource({ stars }: { stars: number | null }) {
  return (
    <section id="open-source" aria-labelledby="open-source-title" className="py-16 sm:py-24">
      <div className={`${container} grid gap-12 lg:grid-cols-2 lg:items-stretch lg:gap-16`}>
        <RepoCard stars={stars} />
        <div>
          <h2 id="open-source-title" className={sectionTitle}>
            Fully Open Source
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-[1.65] text-ink-soft">
            Wireflow is MIT licensed and developed in the open. Fork it, self host it, or contribute. The whole
            project lives on GitHub.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={REPO_URL}>Check on GitHub</Button>
            <Button href="https://opencollective.com/wireflow/contribute" variant="secondary" newTab rel="noopener">
              Support us
            </Button>
          </div>
          <ul className="mt-10 divide-y divide-line border-y border-wire-border">
            {techs.map((t) => (
              <li key={t.name} className="flex gap-3 py-4">
                <Check size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink" aria-hidden />
                <p className="text-sm leading-6 text-ink-soft">
                  <span className="font-medium text-ink">{t.name}</span>
                  <span className="block">{t.text}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
