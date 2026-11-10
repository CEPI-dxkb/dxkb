import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Pin the Turbopack workspace root to this directory. Stray package-lock.json
// files in parent directories otherwise make Next infer an ancestor as the root,
// which breaks file-watching/cache invalidation (nested API routes silently 404).
const projectRoot = dirname(fileURLToPath(import.meta.url));

// Minimal type for webpack rule (avoids depending on full webpack types)
interface WebpackRuleLike {
  test?: { test?(s: string): boolean };
  issuer?: unknown;
  resourceQuery?: { not?: unknown[] } | RegExp;
  exclude?: RegExp;
  use?: string[];
}

interface WebpackConfig {
  module: {
    rules: WebpackRuleLike[];
  };
}

// Next's Server Action CSRF check compares the browser's `Origin` with the
// forwarded host. Behind a reverse proxy that forwards the backend address
// instead of the public one, the two differ and every Server Action (sign-out
// included) is rejected. The fix for that belongs in the proxy
// (`X-Forwarded-Host: <public host>`); as a safety net, this deployment's own
// public host, from `APP_BASE_URL` (the origin it already declares to the
// BV-BRC services, `getAppBaseUrl`), is always accepted. Next loads `.env`
// before this file, and the list is baked in at build time (the standalone
// server serializes this config), so `APP_BASE_URL` must be set where
// `next build` runs, not only where the server starts. Only an http(s) value
// counts, as in `getAppBaseUrl`: `allowedOrigins` compares hosts alone, so
// `ftp://other.example` would otherwise admit `other.example`.
function appBaseHost(): string[] {
  const configured = process.env.APP_BASE_URL;
  if (!configured) return [];
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    // `getAppBaseUrl` reports a malformed value where it is used.
    return [];
  }
  return url.protocol === "http:" || url.protocol === "https:" ? [url.host] : [];
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    serverActions: {
      allowedOrigins: appBaseHost(),
    },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },

  rewrites() {
    return [
      {
        source: "/nextstrain-viewer/:path*",
        destination: "/nextstrain-viewer.html",
      },
    ];
  },

  headers() {
    return [
      {
        source: "/nextstrain-viewer/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/dist/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  webpack(config: WebpackConfig): WebpackConfig {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg"),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },

      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule?.issuer,
        resourceQuery: {
          not: [
            ...((
              fileLoaderRule?.resourceQuery as { not?: unknown[] } | undefined
            )?.not ?? []),
            /url/,
          ],
        }, // exclude if *.svg?url
        use: ["@svgr/webpack"],
      },
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

    return config;
  },

  images: {
    qualities: [25, 50, 75, 80, 90, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
    ],
  },

  turbopack: {
    root: projectRoot,
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
