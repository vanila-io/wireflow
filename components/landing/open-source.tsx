import Link from "next/link";

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

export default function OpenSource() {
  return (
    <section className="w-full bg-wire-lavender py-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
        <div>
          <img
            src="/wireflow-logo.png"
            alt="Wireflow logo"
            className="h-14 w-14"
          />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">
            Fully Open Source
          </h2>
          <p className="mt-4 max-w-md leading-7 text-ink-soft">
            Wireflow is MIT licensed and developed in the open. Fork it, self
            host it, or contribute. The whole project lives on GitHub.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://github.com/vanila-io/wireflow"
              className="inline-block rounded-md border border-ink/80 bg-white px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-ink hover:text-white"
            >
              Check on GitHub
            </a>
            <a
              href="https://opencollective.com/wireflow/contribute"
              target="_blank"
              rel="noopener"
              className="inline-block rounded-md bg-wire-blue px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue-dark"
            >
              Support us
            </a>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {techs.map((t) => (
            <div
              key={t.name}
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-wire-border"
            >
              <div className="flex items-center justify-center py-3 text-2xl font-extrabold tracking-tight text-ink">
                {t.name}
              </div>
              <p className="text-xs leading-5 text-ink-soft">{t.text}</p>
              <Link
                href="https://github.com/vanila-io/wireflow"
                className="mt-4 block rounded-md bg-ink py-2 text-center text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-wire-blue"
              >
                Check on GitHub
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
