import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb"
    }
  }
};

export default nextConfig;
