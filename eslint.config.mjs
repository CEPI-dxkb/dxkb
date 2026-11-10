import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { plugin as shadcn } from "@shadcn/lint";
import tailwind from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Arbitrary Tailwind values with no scale equivalent, allowed repo-wide.
const arbitraryValueAllow = [
  "layout",
  // Transition property lists have no scale equivalent.
  "transition-[width]",
  "transition-[max-width,opacity]",
  "transition-[grid-template-rows]",
  // Single-use sizes kept for exact parity. Promote to a token in
  // globals.css if a second use appears.
  "text-[9px]",
  "text-[13px]",
  "tracking-[0.18em]",
];

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
      ".misc/**",
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
      "tailwindcss/no-custom-classname": "off",
    },
  },
  {
    // Every shadcn rule is an error with no recorded exceptions; components
    // and theme are discovered from components.json.
    plugins: { shadcn },
    rules: {
      "shadcn/no-restyle": [
        "error",
        {
          allow: ["layout"],
          // The last matching entry wins and entries are not merged, so keep
          // patterns disjoint; a wrapper that forwards className is checked
          // against the component it wraps.
          contracts: [
            { pattern: "^TableCell$", allow: ["layout", "spacing"] },
            // Header cells also take opacity for drag feedback.
            {
              pattern: "^TableHead$",
              allow: ["layout", "spacing", "opacity-*"],
            },
            { pattern: "^Card(Content)?$", allow: ["layout", "spacing"] },
            // card.tsx keys the header's bottom padding off `[.border-b]`.
            {
              pattern: "^CardHeader$",
              allow: ["layout", "spacing", "border-b"],
            },
            { pattern: "^Skeleton$", allow: ["layout", "shape", "spacing"] },
            // Opacity hides and reveals a button in place; `shadow-sm` lifts
            // controls floating over a map canvas.
            {
              pattern: "^Button$",
              allow: ["layout", "opacity-*", "shadow-sm"],
            },
            { pattern: "^ResizableHandle$", allow: ["layout", "opacity-*"] },
            // The unstyled Base UI collapsible parts take callers' classes.
            {
              pattern: "^Collapsible(Trigger|Content)?$",
              allow: [
                "layout",
                "spacing",
                "typography",
                "color",
                "shape",
                "effects",
                "motion",
              ],
            },
          ],
        },
      ],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": ["error", { allow: arbitraryValueAllow }],
      "shadcn/no-inline-styles": [
        "error",
        {
          contracts: [
            // dnd-kit's runtime transition shorthand has no utility.
            { pattern: "^TableHead$", allow: ["transition"] },
          ],
        },
      ],
      "shadcn/require-static-classes": "error",
      "shadcn/no-unknown-classes": [
        "error",
        {
          allow: [
            // Styled by src/styles/archaeopteryx-theme.css, imported by
            // phylogeny.tsx outside the theme's import graph.
            "archaeopteryx-dxkb",
            // Selector hook for the e2e page objects; carries no styles.
            "welcome-search-card",
          ],
        },
      ],
    },
  },
  {
    // Components own their appearance; services/form-ui wrappers own the
    // global `service-*` classes, and callers' classes are still checked
    // against the wrapped part.
    files: ["src/components/ui/**", "src/components/services/form-ui/**"],
    rules: {
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/require-static-classes": "off",
    },
  },
  {
    // Only properties carrying runtime geometry or series colors are allowed;
    // anything else, and unreadable style objects, still report.
    files: [
      "src/components/organisms/metadata-distributions/**",
      "src/components/organisms/geo-distribution/**",
      "src/components/interactions/sigma/**",
    ],
    rules: {
      "shadcn/no-inline-styles": [
        "error",
        {
          allow: [
            "left",
            "right",
            "top",
            "width",
            "height",
            "x",
            "y",
            "transform",
            "opacity",
            "background",
            "backgroundColor",
            "borderColor",
          ],
        },
      ],
    },
  },
  {
    // Keeps `text-[12px]` because `text-xs` would replace the inherited
    // line-height ratio with a fixed 16px.
    files: [
      "src/components/organisms/metadata-distributions/_shared/chart-legend-pill.tsx",
    ],
    rules: {
      "shadcn/no-arbitrary-values": [
        "error",
        { allow: [...arbitraryValueAllow, "text-[12px]"] },
      ],
    },
  },
  {
    // Tests pass placeholder class names on purpose.
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "shadcn/no-unknown-classes": "off",
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
    // Fixture data may be imported only by the loopback, the Vitest parity
    // tests and the e2e overrides, never the shipped app; `server-only` is
    // not used because Playwright's own Node process imports it.
    // `src/__tests__/e2e-fixtures-import-boundary.test.ts` pins this
    // allowlist.
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
                // A directory glob, so a relative import of any third fixture
                // module is also restricted.
                "**/e2e-fixtures/*",
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
    // useVirtualizer returns functions that cannot be memoized; each call
    // site carries "use no memo".
    files: [
      "src/components/shared/data-table.tsx",
      "src/components/shared/data-table-header.tsx",
      "src/components/shared/data-table-controls.tsx",
      "src/components/shared/data-table-footer.tsx",
      "src/components/workspace/file-viewer/viewers/csv-viewer.tsx",
      "src/components/organisms/reference-genomes/reference-genomes-client.tsx",
      "src/components/taxonomy/taxonomy-tree.tsx",
    ],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
);