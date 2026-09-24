import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship native/worker-style code that must stay outside the bundle.
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
