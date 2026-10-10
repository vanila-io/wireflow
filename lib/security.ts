// Response headers for every page of this app (#104), added in next.config.ts.
//
// Content-Security-Policy, the "without nonces" form from the Next.js CSP
// guide: Next.js puts inline <script> tags (the React Server Components
// payload) in every page, and nonces would make every page render per request
// while these are prerendered. So scripts are limited to this origin, inline,
// and the analytics a deployment turns on, and the rest of the policy does the
// work: connections only to this origin, Anthropic's API (the AI assistant,
// with the user's own key) and configured analytics; no plugins, no <base>, no
// forms to other sites, no framing.
import { analytics } from "./env";

type Env = Record<string, string | undefined>;

export function contentSecurityPolicy(env: Env = process.env, { dev = env.NODE_ENV !== "production" } = {}) {
  const { rybbit, gaId } = analytics(env);
  // Cloudflare Web Analytics, if the zone injects its beacon (see README).
  const cfBeacon = env.CLOUDFLARE_WEB_ANALYTICS === "1";
  const ga = gaId ? ["https://www.googletagmanager.com"] : [];
  const gaConnect = gaId
    ? ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"]
    : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' only for the dev server (React's dev tooling needs it).
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      ...(rybbit ? [rybbit.origin] : []),
      ...ga,
      ...(cfBeacon ? ["https://static.cloudflareinsights.com"] : []),
    ],
    // React Flow and the editor position things with inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Sponsor avatars on the landing page come from wherever Open Collective
    // hosts them, so any https image is allowed (images can't run code).
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      "https://api.anthropic.com",
      ...(rybbit ? [rybbit.origin] : []),
      ...gaConnect,
      ...(cfBeacon ? ["https://cloudflareinsights.com"] : []),
      ...(dev ? ["ws:"] : []),
    ],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(env: Env = process.env) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
}

// Every path of this app; /blog and /blog/* (Ghost, see BLOG_ORIGIN) keep their own headers.
export const APP_PATHS = "/((?!blog(?:/|$)).*)";
