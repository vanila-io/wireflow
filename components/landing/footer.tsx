import Link from "next/link";
import { Logo } from "./header";
import { label } from "./ui";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/app", label: "Flow editor" },
      { href: "https://wireflow.co/blog/", label: "Blog" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "https://github.com/vanila-io/wireflow", label: "GitHub repository" },
      { href: "https://opencollective.com/wireflow/contribute", label: "Support on Open Collective" },
      { href: "https://automatio.ai/", label: "Crafted by Automatio team" },
    ],
  },
];

const linkClass = "rounded-md text-[15px] text-night/80 transition-colors hover:text-wire-blue";

// A white card that sits on the warm wash, which shows below and beside it.
export default function Footer() {
  return (
    <footer className="relative bg-paper-deep px-3 pt-4 sm:px-6 sm:pt-8">
      <div className="landing-aura absolute inset-x-0 bottom-0 top-1/3" aria-hidden />
      <div className="relative mx-auto max-w-[1240px] rounded-[24px] bg-white px-6 py-10 shadow-[0_30px_80px_-40px_rgba(27,26,31,0.35)] sm:rounded-[28px] sm:px-12 sm:py-14 lg:px-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-6 text-ink-soft">
              Free, online and open source tool for creating beautiful user flow prototypes. No Photoshop skills
              required.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className={label}>{col.title}</h2>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.href.startsWith("/") ? (
                      <Link href={l.href} className={linkClass}>
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className={linkClass}>
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 border-t border-line pt-6 text-sm text-ink-soft">
          Wireflow - user flow chart tool. MIT licensed, built by the Vanila team.
        </p>
      </div>
      <div className="h-10 sm:h-16" aria-hidden />
    </footer>
  );
}
