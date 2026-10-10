// Analytics, configured with environment variables at build time (the pages are
// prerendered). Everything here is optional: unset, the site loads no
// third-party script. See README "Environment variables".
//
// Rybbit needs only its script URL and the site id. Its API key (data-api-key)
// is for tracking from localhost during development and must not be in a
// deployed page (https://rybbit.com/docs/localhost-tracking), so there is no
// variable for it.

export type Analytics = {
  /** Self-hosted Rybbit: script URL, site id, and the origin it reports to. */
  rybbit?: { src: string; siteId: string; origin: string };
  /** Google Analytics 4 measurement id, e.g. G-ABC123. */
  gaId?: string;
};

type Env = Record<string, string | undefined>;

function httpsUrl(value: string | undefined, name: string): URL | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL, got ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "https:") throw new Error(`${name} must be an https:// URL`);
  return url;
}

// Throws (and so fails the build) on a malformed value instead of shipping it.
export function analytics(env: Env = process.env): Analytics {
  const result: Analytics = {};

  const rybbitSrc = httpsUrl(env.NEXT_PUBLIC_RYBBIT_SRC, "NEXT_PUBLIC_RYBBIT_SRC");
  const siteId = env.NEXT_PUBLIC_RYBBIT_SITE_ID;
  if (rybbitSrc) {
    if (!siteId || !/^[\w-]+$/.test(siteId)) {
      throw new Error("NEXT_PUBLIC_RYBBIT_SITE_ID must be set (letters, digits, _ or -) with NEXT_PUBLIC_RYBBIT_SRC");
    }
    result.rybbit = { src: rybbitSrc.href, siteId, origin: rybbitSrc.origin };
  }

  const gaId = env.NEXT_PUBLIC_GA_ID;
  if (gaId) {
    // It is written into an inline script, so it must be exactly an id.
    if (!/^G-[A-Z0-9]+$/.test(gaId)) {
      throw new Error(`NEXT_PUBLIC_GA_ID must look like G-ABC123, got ${JSON.stringify(gaId)}`);
    }
    result.gaId = gaId;
  }
  return result;
}
