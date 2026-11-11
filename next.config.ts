import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

// Pin the Turbopack root: stray lockfiles in parent directories otherwise
// make Next infer an ancestor, breaking cache invalidation (nested API routes
// silently 404).
const projectRoot = dirname(fileURLToPath(import.meta.url));

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
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg"),
    );

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },

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
        },
        use: ["@svgr/webpack"],
      },
    );

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
