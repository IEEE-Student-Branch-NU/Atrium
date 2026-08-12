import "dotenv/config";
import type { NextConfig } from "next";

/**
 * Atrium Next.js configuration.
 *
 * The defaults leave real performance on the table for an ops dashboard whose
 * users navigate between pages constantly. The settings below are the low-risk,
 * high-value wins; the higher-risk opt-ins (React Compiler, experimental
 * `inlineCss`) are documented in CLAUDE.md § Performance and left disabled until
 * verified against this Next build.
 */
const nextConfig: NextConfig = {
  // Surface React foot-guns in dev; no production cost.
  reactStrictMode: true,

  // Explicit gzip (default, but pinned so a future edit can't silently drop it).
  compress: true,

  // Drop the `x-powered-by` fingerprint header from every response.
  poweredByHeader: false,

  // `bcrypt` is a native (node-gyp) addon — keep it out of the Server Components
  // bundle and let Node `require` it directly. Prevents bundling failures and
  // shaves the server bundle.
  serverExternalPackages: ["bcrypt"],

  // The one <Image> usage points at ImageKit; allow it so optimization works
  // instead of the image being served unoptimized or blocked.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ik.imagekit.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
    ],
  },

  experimental: {
    // Tree-shake the Base-UI primitive kit to only the components used per route.
    // `lucide-react` and `recharts` are already optimized by default in this
    // Next version, so they don't need listing here.
    optimizePackageImports: ["@base-ui/react"],

    // Client-side Router Cache. Default `dynamic` is 0 (every back/forward or
    // repeat navigation refetches the RSC payload from the server). An ops tool
    // hops between the same handful of pages repeatedly — caching dynamic
    // segments for 30s makes those repeat navigations feel instant. Server
    // Actions still call revalidatePath(), which invalidates on mutation, so
    // this only affects passive re-navigation, not freshness after a change.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
