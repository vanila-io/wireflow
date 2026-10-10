// OpenNext for Cloudflare: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// "/" is regenerated in the background every hour (lib/sponsors.ts fetches with
// revalidate: 3600), so prerendered pages live in an R2 incremental cache and a
// stale one is revalidated through the memory queue. Bindings: wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
