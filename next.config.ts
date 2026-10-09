import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
