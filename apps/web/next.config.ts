import type { NextConfig } from "next";

// Static export so the same build can be wrapped by Capacitor for the APK.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  devIndicators: false,
};

export default nextConfig;
