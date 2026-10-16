import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/mill-inward": ["./src/server/pdf/fonts/**/*"],
    "/mill-program": ["./src/server/pdf/fonts/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
