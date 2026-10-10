// OpenNext for Cloudflare: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// "/" is regenerated in the background every hour (revalidate: 3600 in
// app/page.tsx, for the GitHub star count and the sponsors: lib/github.ts,
// lib/sponsors.ts), so prerendered pages live in an R2 incremental cache and a
// stale one is revalidated through the memory queue. Bindings: wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
