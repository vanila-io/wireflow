// Building blocks shared by the landing page sections (not used by the editor).
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// One content width for every section: 1056 px of content at 1440 px.
export const container = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";

// Type scale (Geist): display 44/56/64, section title 32/44, card title 17, body 16-18, label 12.
export const sectionTitle =
  "text-[32px] font-medium leading-[1.12] tracking-[-0.03em] text-night sm:text-[44px]";
export const label = "text-xs font-medium uppercase tracking-[0.12em] text-ink-soft";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  /** The white arrow chip at the end of a primary button. */
  arrow?: boolean;
  /** A smaller button, for the header. */
  compact?: boolean;
  newTab?: boolean;
  rel?: string;
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  arrow = variant === "primary",
  compact = false,
  newTab = false,
  rel,
  className = "",
}: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-night text-white hover:bg-black"
      : "border border-line bg-white text-night hover:border-night/30";
  const size = compact ? "h-10 text-sm" : "h-12 text-[15px]";
  const padding = arrow ? (compact ? "pl-4 pr-1" : "pl-5 pr-1.5") : compact ? "px-4" : "px-6";
  const classes = `group inline-flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl font-medium transition-colors ${look} ${size} ${padding} ${className}`;
  const content = (
    <>
      {children}
      {arrow && (
        <span
          className={`flex items-center justify-center rounded-lg bg-white text-night ${compact ? "h-8 w-8" : "h-9 w-9"}`}
          aria-hidden
        >
          <ArrowRight size={16} strokeWidth={2.2} className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
        </span>
      )}
      {newTab && <span className="sr-only"> (opens in a new tab)</span>}
    </>
  );
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} rel={rel} target={newTab ? "_blank" : undefined}>
      {content}
    </a>
  );
}

export function GitHubMark({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 3.01 1.25 3.74.96.11-.75.43-1.26.78-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.44.38.83 1.11.83 2.25 0 1.63-.01 2.94-.01 3.34 0 .31.21.68.8.56A10.52 10.52 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
