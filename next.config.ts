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

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
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
