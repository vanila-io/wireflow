import type { NextConfig } from "next";
import { APP_PATHS, securityHeaders } from "./lib/security";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  // Don't advertise the framework.
  poweredByHeader: false,
  // Content-Security-Policy and other security headers (lib/security.ts), not on /blog.
  async headers() {
    return [{ source: APP_PATHS, headers: securityHeaders() }];
  },
};

export default nextConfig;
