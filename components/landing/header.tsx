import Link from "next/link";
import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/wireflow-logo.png"
        alt="Wireflow logo"
        width={34}
        height={34}
        priority
      />
      <span className="leading-tight">
        <span className="block text-[17px] font-bold text-ink">Wireflow</span>
        <span className="block text-[11px] font-medium tracking-wide text-ink-soft">
          user flow designer tool
        </span>
      </span>
    </Link>
  );
}

export default function Header() {
  return (
    <header className="w-full border-b border-wire-border/60 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-7 text-sm font-semibold text-ink">
          <a
            href="https://wireflow.co/blog/"
            className="hidden items-center gap-1.5 hover:text-wire-blue sm:flex"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Blog
          </a>
          <a
            href="https://github.com/vanila-io/wireflow"
            className="hidden items-center gap-1.5 hover:text-wire-blue sm:flex"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 3.01 1.25 3.74.96.11-.75.43-1.26.78-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.44.38.83 1.11.83 2.25 0 1.63-.01 2.94-.01 3.34 0 .31.21.68.8.56A10.52 10.52 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
            </svg>
            Open Source
          </a>
          <a
            href="https://automatio.ai/"
            className="hidden items-center gap-1.5 text-ink-soft hover:text-wire-blue md:flex"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Crafted by Automatio team
          </a>
          <Link
            href="/app"
            className="rounded-md bg-wire-blue px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-wire-blue-dark"
          >
            Start designing
          </Link>
        </nav>
      </div>
    </header>
  );
}
