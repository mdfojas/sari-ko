import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root also has a package-lock.json (for the root `concurrently`
  // dev script), which makes Turbopack guess the wrong workspace root.
  // Pin it explicitly to this directory.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
  // Dev-only: proxy /api/* to the local Fastify backend so local dev has no
  // CORS friction and feels like one app. Production calls the deployed
  // backend directly via NEXT_PUBLIC_API_BASE_URL — see the frontend
  // dashboard spec's "Local dev convenience" section.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/:path*",
      },
    ];
  },
};

export default nextConfig;
