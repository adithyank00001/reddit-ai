import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Set the workspace root to silence the lockfile warning
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
