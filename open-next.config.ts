// OpenNext for Cloudflare: https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// Every page is prerendered at build time and nothing revalidates, so the
// prerendered pages are served read-only from Workers static assets. No R2
// bucket or KV namespace is needed.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
