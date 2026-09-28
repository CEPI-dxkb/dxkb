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
      // Custom classes defined in globals.css are valid — the plugin can't parse @apply-based class definitions
      "tailwindcss/no-custom-classname": "off",
      // Too noisy — many legitimate arbitrary values have no preset equivalent (e.g. min(), vh+rem combos, percentages)
      // "tailwindcss/no-arbitrary-value": "on",
    },
  },
  {
    // @shadcn/lint design-system rules, configured as in the upstream adoption
    // guide (https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md).
    // Components and theme are discovered from components.json (ui alias
    // `@/components/ui`, theme `src/app/globals.css`), so no
    // `settings.shadcn` is needed.
    //
    // Every rule is an error and the tree has no recorded exceptions.
    plugins: { shadcn },
    rules: {
      "shadcn/no-restyle": [
        "error",
        {
          allow: ["layout"],
          // The rule applies one contract per component: the LAST entry whose
          // pattern matches wins, and entries are not merged. Keep the
          // patterns disjoint so each component matches exactly one entry.
          // A wrapper that forwards className (e.g. ServiceCollapsibleTrigger)
          // is checked against the contract of the component it wraps.
          contracts: [
            // Padding is set per table cell.
            { pattern: "^TableCell$", allow: ["layout", "spacing"] },
            // Header cells also take opacity, for drag feedback on a column
            // being reordered.
            {
              pattern: "^TableHead$",
              allow: ["layout", "spacing", "opacity-*"],
            },
            // Card padding and gap are set per card, as for its content.
            { pattern: "^Card(Content)?$", allow: ["layout", "spacing"] },
            // CardHeader also allows `border-b`: card.tsx keys the header's
            // own bottom padding off `[.border-b]` (upstream API).
            {
              pattern: "^CardHeader$",
              allow: ["layout", "spacing", "border-b"],
            },
            // A skeleton's size and shape mirror the content it stands in for.
            { pattern: "^Skeleton$", allow: ["layout", "shape", "spacing"] },
            // Opacity hides and reveals a button in place (collapsed-panel
            // swaps, hover reveals); `shadow-sm` lifts controls that float
            // over a map canvas. Neither restyles the button.
            {
              pattern: "^Button$",
              allow: ["layout", "opacity-*", "shadow-sm"],
            },
            // Opacity reveals the handle on hover.
            { pattern: "^ResizableHandle$", allow: ["layout", "opacity-*"] },
            // ui/collapsible.tsx gives the root, trigger and panel no classes
            // of their own (unstyled Base UI primitives; the panel only adds
            // a divider child), so callers style them.
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
            // Sortable column headers take dnd-kit's runtime transition
            // shorthand ("transform 200ms ease"), which no utility expresses.
            { pattern: "^TableHead$", allow: ["transition"] },
          ],
        },
      ],
      "shadcn/require-static-classes": "error",
      "shadcn/no-unknown-classes": [
        "error",
        {
          allow: [
            // Styled by src/styles/archaeopteryx-theme.css, which
            // organisms/taxon-views/phylogeny.tsx imports outside the theme's
            // import graph.
            "archaeopteryx-dxkb",
            // Selector hook for the e2e page objects (e2e/pages/*-page.ts);
            // carries no styles.
            "welcome-search-card",
          ],
        },
      ],
    },
  },
  {
    // Components own their appearance and may need structural values such as
    // `ring-[3px]`. no-raw-colors and no-inline-styles stay on here.
    // services/form-ui holds the service form wrappers, which own the global
    // `service-*` classes they apply to the parts they wrap. Classes callers
    // pass to a wrapper are still checked against the wrapped part.
    files: ["src/components/ui/**", "src/components/services/form-ui/**"],
    rules: {
      "shadcn/no-restyle": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/require-static-classes": "off",
    },
  },
  {
    // Chart and map geometry is computed at runtime: cursor-anchored tooltip
    // positions, bar extents, slice pop offsets and animation opacity, the
    // map height, data-driven series colors. Only the properties that carry
    // those values are allowed; any other inline property, and any style
    // object the rule cannot read (a spread or a call), is still reported.
    // Static values of these properties still belong in classes.
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
    // The non-pill label in this file keeps `text-[12px]` rather than
    // `text-xs` because it inherits its parent's unitless line-height ratio
    // (17.14px here), which `text-xs` would replace with a fixed 16px.
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
    // Tests pass placeholder class names (e.g. `cn("foo", "bar")`) on purpose.
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
                // Directory glob, not two filenames: pinning `records` and
                // `envelopes` by name left the relative-import form of any
                // *third* fixture module unrestricted, so the zone enforced
                // two filenames rather than the boundary the docs credit it
                // with. Verified with a throwaway fixture module imported
                // from e2e/pages/ both ways.
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
    // TanStack Virtual's useVirtualizer returns functions and refs that can't be
    // safely memoized, so React Compiler skips these components. The "use no memo"
    // directive is in place at each call site. Silencing
    // the rule here keeps the signal useful elsewhere — a new file using an
    // incompatible hook without mitigation will still warn.
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