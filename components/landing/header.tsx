import Link from "next/link";
import Image from "next/image";
import { Menu, PenLine, X } from "lucide-react";
import { Button, container, GitHubMark } from "./ui";

export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 rounded-lg ${className}`}>
      <Image src="/wireflow-logo.png" alt="Wireflow logo" width={34} height={34} priority className="mix-blend-multiply" />
      <span className="leading-tight">
        <span className="block text-[17px] font-semibold tracking-[-0.01em] text-ink">Wireflow</span>
        <span className={`${compact ? "hidden sm:block" : "block"} text-[11px] font-medium tracking-wide text-ink-soft`}>
          user flow designer tool
        </span>
      </span>
    </Link>
  );
}

const links = [
  { href: "https://wireflow.co/blog/", label: "Blog", icon: <PenLine size={15} aria-hidden /> },
  { href: "https://github.com/vanila-io/wireflow", label: "Open Source", icon: <GitHubMark size={16} /> },
  {
    href: "https://automatio.ai/",
    label: "Crafted by Automatio team",
    icon: <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />,
  },
];

export default function Header() {
  return (
    <header className="relative z-20 border-b border-wire-border bg-white">
      <div className={`${container} flex h-[76px] items-center justify-between gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr]`}>
        <Logo compact />

        <nav aria-label="Main" className="hidden items-center gap-8 text-[15px] text-ink lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="flex items-center gap-2 rounded-md transition-colors hover:text-wire-blue">
              {l.icon}
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Button href="/app" compact>
            Start designing
          </Button>
          {/* Phones and tablets: the same links behind a disclosure (works without JavaScript). */}
          <details className="group/menu relative lg:hidden">
            <summary
              aria-label="Menu"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-wire-border bg-white text-ink [&::-webkit-details-marker]:hidden"
            >
              <Menu size={18} className="group-open/menu:hidden" aria-hidden />
              <X size={18} className="hidden group-open/menu:block" aria-hidden />
            </summary>
            <nav
              aria-label="Main"
              className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-wire-border bg-white p-2 shadow-[0_20px_50px_-20px_rgba(27,26,31,0.35)]"
            >
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-ink hover:bg-wire-canvas"
                >
                  <span className="flex w-4 justify-center">{l.icon}</span>
                  {l.label}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
