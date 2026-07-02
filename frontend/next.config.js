/** @type {import('next').NextConfig} */

// Fail the build when required server-side env vars are absent in production.
// This makes the "missing NEXTAUTH_SECRET → silent login failure" class of bugs
// structurally impossible: Vercel refuses to deploy if the var is not set.
if (process.env.NODE_ENV === "production") {
  // NEXTAUTH_SECRET: NextAuth session signing.
  // NEXT_PUBLIC_API_URL: FastAPI backend URL — baked into the client bundle at build time.
  //   If absent the bundle defaults to http://localhost:8000 and all API calls fail in prod.
  // DATABASE_URL is intentionally NOT here: auth is delegated to FastAPI; Prisma routes
  //   (/api/admin/users, /api/user/incidents) are optional features that fail gracefully.
  const REQUIRED = ["NEXTAUTH_SECRET", "NEXT_PUBLIC_API_URL"];
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[sentinel-ai] Missing required environment variables: ${missing.join(", ")}. ` +
      `Set them in Vercel Dashboard → Settings → Environment Variables.`
    );
  }
}

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },

  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  async headers() {
    // Derive API origin so connect-src is tight rather than wildcard
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let apiOrigin = apiUrl;
    try {
      apiOrigin = new URL(apiUrl).origin;
    } catch {
      // fallback: use the value as-is
    }
    const wsOrigin = apiOrigin.replace(/^https?/, "ws");
    const wssOrigin = apiOrigin.replace(/^https?/, "wss");

    // Next.js App Router requires 'unsafe-inline' for its hydration scripts.
    // Dev mode's webpack HMR runtime also requires 'unsafe-eval' (eval-source-map) —
    // without it the client bundle throws and the app fails to run in the browser.
    // A nonce-based approach via middleware would allow removing 'unsafe-inline' but adds complexity.
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Leaflet map tiles come from CartoDB CDN subdomains (a–d)
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
      `connect-src 'self' ${apiOrigin} ${wsOrigin} ${wssOrigin}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      // Service worker — must not be cached
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Manifest
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      // Security headers applied to all routes
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer information
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          // XSS protection (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Content Security Policy
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
