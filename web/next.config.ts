import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the slim Cloud Run Dockerfile — Next emits a self-contained
  // .next/standalone server we can copy into a thin runtime image.
  output: "standalone",
};

export default nextConfig;
