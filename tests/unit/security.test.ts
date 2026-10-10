import { describe, expect, it } from "vitest";
import { APP_PATHS, contentSecurityPolicy, securityHeaders } from "@/lib/security";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("security headers", () => {
  it("allows connections only to this origin and Anthropic, with no analytics configured", () => {
    const csp = contentSecurityPolicy({ NODE_ENV: "production" });
    expect(directive(csp, "connect-src")).toEqual(["'self'", "https://api.anthropic.com"]);
    expect(directive(csp, "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
  });

  it("adds exactly the analytics a deployment turns on", () => {
    const csp = contentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_RYBBIT_SRC: "https://stats.example.com/api/script.js",
      NEXT_PUBLIC_RYBBIT_SITE_ID: "3",
      NEXT_PUBLIC_GA_ID: "G-ABC123",
      CLOUDFLARE_WEB_ANALYTICS: "1",
    });
    expect(directive(csp, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://stats.example.com",
      "https://www.googletagmanager.com",
      "https://static.cloudflareinsights.com",
    ]);
    expect(directive(csp, "connect-src")).toContain("https://stats.example.com");
    expect(directive(csp, "connect-src")).toContain("https://cloudflareinsights.com");
  });

  it("allows eval and websockets only for the dev server", () => {
    expect(directive(contentSecurityPolicy({ NODE_ENV: "development" }), "script-src")).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ NODE_ENV: "production" })).not.toMatch(/unsafe-eval|ws:/);
  });

  it("sends the usual hardening headers", () => {
    expect(securityHeaders({ NODE_ENV: "production" }).map((h) => h.key)).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
    ]);
  });

  it("covers every app path but not the blog", () => {
    const re = new RegExp(`^${APP_PATHS.slice(1)}$`.replace(/^\^\(/, "^/("));
    for (const p of ["/", "/app", "/manifest.webmanifest", "/blogger", "/no-such-page"])
      expect(re.test(p), p).toBe(true);
    for (const p of ["/blog", "/blog/", "/blog/a-post/"]) expect(re.test(p), p).toBe(false);
  });
});
