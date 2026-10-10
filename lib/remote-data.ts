// What the landing page does when a data source it fetches from another site
// (GitHub's star count, Open Collective's sponsors) can't be read.
//
// "/" is prerendered by `next build` and regenerated in the background at most
// once an hour (ISR: `revalidate` in app/page.tsx; the R2 incremental cache on
// Cloudflare, the disk in Docker).
// - During `next build` there is no earlier page to keep, so the caller's
//   fallback is used: the star count is hidden, the sponsors list is empty.
// - During a background regeneration in production this throws. Next.js then
//   keeps serving the last page it generated successfully, with the last good
//   numbers, and tries again on a later request.
// - Anywhere else (next dev, unit tests) the fallback is used.

type Env = Record<string, string | undefined>;

export class RemoteDataError extends Error {
  name = "RemoteDataError";
}

export function unavailable<T>(fallback: T, reason: string, env: Env = process.env): T {
  const regenerating = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
  if (regenerating) throw new RemoteDataError(`${reason}; keeping the last generated page`);
  console.warn(`${reason}; rendering without it`);
  return fallback;
}
