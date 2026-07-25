import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts matches /api/:path* (needed for the browser extension's CORS
    // headers), which makes Next.js buffer every proxied request body in
    // memory up to a limit that defaults to 10MB. Meeting/lecture/podcast
    // recordings (audio or video) routinely exceed that, so raise it to
    // comfortably fit real uploads.
    proxyClientMaxBodySize: '500mb',
  },
};

export default nextConfig;
