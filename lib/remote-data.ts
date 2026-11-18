// What the landing page does when a data source it fetches from another site
// (GitHub's star count, Open Collective's sponsors) can't be read.
//
// "/" is prerendered by `next build` and regenerated in the background at most
// once an hour (ISR: `revalidate` in app/page.tsx; the R2 incremental cache on
// Cloudflare, the disk in Docker).
// - During `next build` there is no earlier page to keep, so the caller's
//   fallback is used: the star count is hidden, the sponsors list is empty.
// - During production regeneration, the Cloudflare runtime may have no prior
//   cached page to serve (for example immediately after a deployment). Always
//   use the fallback so an upstream outage cannot turn the landing page into a
//   500; a later revalidation can fill in the live numbers again.
// - In development and tests, the same fallback is used.

export function unavailable<T>(fallback: T, reason: string): T {
  console.warn(`${reason}; rendering without it`);
  return fallback;
}
