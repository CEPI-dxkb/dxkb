import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "public/dist/**",
      "public/nextstrain-viewer.html",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts"
    ],
  },
  eslint.configs.recommended,
  ...nextCoreWebVitals,
  ...nextTypescript,
  tailwind.configs.recommended,
  {
    plugins: {
      tailwindcss: tailwind,
    },
    settings: {
      tailwindcss: {
        cssConfigPath: resolve(__dirname, "src/app/globals.css"),
        functions: ["cn", "cva", "clsx", "twMerge", "classnames", "ctl", "tv", "tw"],
      },
    },
    rules: {
      // Custom classes defined in globals.css are valid — the plugin can't parse @apply-based class definitions
      "tailwindcss/no-custom-classname": "off",
      // Too noisy — many legitimate arbitrary values have no preset equivalent (e.g. min(), vh+rem combos, percentages)
      // "tailwindcss/no-arbitrary-value": "on",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylistic],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // note you must disable the base rule
      // as it can report incorrect errors
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": [
        "warn",
        {
          ignoreRestArgs: true,
        },
      ],
    },
  },
  {
    // `src/lib/e2e-fixtures/**` holds deterministic Playwright fixture DATA.
    // It lives under `src/` so the loopback mock route and the Vitest parity
    // tests can import it, but nothing in the shipped application may: a
    // client component importing it would bundle fake genomes into the
    // browser payload. `server-only` is deliberately NOT used — Playwright's
    // own Node process legitimately imports the browser override bundles that
    // re-export these records, and `server-only` would break that.
    //
    // The allowlist below is the complete set of legitimate importers, and
    // `src/__tests__/e2e-fixtures-import-boundary.test.ts` pins it: that test
    // fails if this list and the files that actually import the module ever
    // disagree, in either direction.
    files: ["src/**/*.{ts,tsx}", "e2e/**/*.{ts,tsx,mts}"],
    ignores: [
      "src/lib/e2e-fixtures/**",
      "src/app/api/e2e-mock/**",
      "e2e/fixtures/overrides/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/e2e-fixtures",
                "@/lib/e2e-fixtures/*",
                "**/e2e-fixtures/records",
                "**/e2e-fixtures/envelopes",
              ],
              message:
                "src/lib/e2e-fixtures is E2E fixture data. Only the e2e-mock route handler, the e2e/fixtures/overrides bundles, and the fixture module's own tests may import it.",
            },
          ],
        },
      ],
    },
  },
  {
    // TanStack Virtual's useVirtualizer returns functions and refs that can't be
    // safely memoized, so React Compiler skips these components. The "use no memo"
    // directive is in place at each call site. Silencing
    // the rule here keeps the signal useful elsewhere — a new file using an
    // incompatible hook without mitigation will still warn.
    files: [
      "src/components/shared/data-table.tsx",
      "src/components/workspace/file-viewer/viewers/csv-viewer.tsx",
      "src/components/organisms/reference-genomes/reference-genomes-client.tsx",
      "src/components/taxonomy/taxonomy-tree.tsx",
    ],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
);