import type { NextConfig } from "next";

// Until the public flip on 10/29, every response carries noindex.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The cron reads Paula's rubric for the promote gate, which the bundler cannot see from a path built at run time.
  outputFileTracingIncludes: { "/api/cron/precompute": ["./evals/digest/rubric.csv"] },
  // ?open=calendar on the desk serves the prebuilt /office/calendar page, so deep links stay static and cached.
  // It runs before the page check, because "/" is itself a page and would otherwise win.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "query", key: "open", value: "(?<view>brief|ask|calendar|numbers|engine|coffee|gm|cheers)" }],
          destination: "/office/:view",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
