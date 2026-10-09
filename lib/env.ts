// Build-time configuration from environment variables. Everything here is
// optional: unset, the app loads no analytics. See README "Environment variables".

export type Analytics = {
  /** Self-hosted Rybbit: script URL and site id. */
  rybbit?: { src: string; siteId: string; origin: string };
  /** Google Analytics 4 measurement id, e.g. G-ABC123. */
  gaId?: string;
};

function httpsUrl(value: string | undefined, name: string): URL | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL, got ${JSON.stringify(value)}`);
  }
  if (url.protocol !== 'https:') throw new Error(`${name} must be an https:// URL`);
  return url;
}

export function analytics(env: Record<string, string | undefined> = process.env): Analytics {
  const result: Analytics = {};

  const rybbitSrc = httpsUrl(env.NEXT_PUBLIC_RYBBIT_SRC, 'NEXT_PUBLIC_RYBBIT_SRC');
  const siteId = env.NEXT_PUBLIC_RYBBIT_SITE_ID;
  if (rybbitSrc) {
    if (!siteId || !/^[\w-]+$/.test(siteId)) throw new Error('NEXT_PUBLIC_RYBBIT_SITE_ID must be set with NEXT_PUBLIC_RYBBIT_SRC');
    result.rybbit = { src: rybbitSrc.href, siteId, origin: rybbitSrc.origin };
  }

  const gaId = env.NEXT_PUBLIC_GA_ID;
  if (gaId) {
    // It is written into an inline script, so it must be exactly an id.
    if (!/^G-[A-Z0-9]+$/.test(gaId)) throw new Error(`NEXT_PUBLIC_GA_ID must look like G-ABC123, got ${JSON.stringify(gaId)}`);
    result.gaId = gaId;
  }
  return result;
}
