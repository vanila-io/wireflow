import type { NextConfig } from 'next';
import { APP_PATHS, securityHeaders } from './lib/security';

// Optional: the origin that serves the Ghost blog under /blog/ (for example
// https://blog-origin.example.com). Production routes /blog/* to Ghost outside
// this app; set BLOG_ORIGIN only if this app should proxy it instead. Unset,
// the app has no /blog route at all, so it can't shadow one.
const blogOrigin = process.env.BLOG_ORIGIN?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  // Production serves template graphics and the logo as plain files (no
  // /_next/image optimizer).
  images: { unoptimized: true },
  // Don't advertise the framework (production sent x-powered-by: Next.js).
  poweredByHeader: false,
  // CSP and other security headers (lib/security.ts), not on /blog.
  async headers() {
    return [{ source: APP_PATHS, headers: securityHeaders() }];
  },
  ...(blogOrigin && {
    // Ghost serves every page at a URL ending in "/" and redirects the other
    // form, while Next.js by default redirects "/x/" to "/x": together they
    // would loop. Keep paths exactly as requested instead.
    skipTrailingSlashRedirect: true,
    async rewrites() {
      // (.*) keeps the trailing slash that Ghost expects. Ghost itself
      // redirects /blog to /blog/, as on production.
      return [
        { source: '/blog/:path(.*)', destination: `${blogOrigin}/blog/:path` },
        { source: '/blog', destination: `${blogOrigin}/blog` },
      ];
    },
  }),
};

export default nextConfig;
