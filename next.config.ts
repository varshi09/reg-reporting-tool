import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "regulatoryreporting",
    "regulatoryreporting.localhost",
    "regulatoryreporting.test",
  ],
};

export default nextConfig;
