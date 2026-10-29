import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const monacoVersion = JSON.parse(readFileSync(new URL("./node_modules/monaco-editor/package.json", import.meta.url), "utf8")).version;
const isDev = process.env.NODE_ENV !== "production";

// All Stellar RPC traffic goes straight from the browser to the RPC the user picks,
// so connect-src must allow any HTTPS origin (and localhost for quickstart nodes).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output is for the Docker image; Vercel builds its own deployment format.
  output: process.env.VERCEL ? undefined : "standalone",
  transpilePackages: [
    "@playground/shared-types",
    "@playground/contract-loader",
    "@playground/result-parser",
    "@playground/simulation-engine",
  ],
  env: { NEXT_PUBLIC_MONACO_VERSION: monacoVersion },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/monaco/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default config;
