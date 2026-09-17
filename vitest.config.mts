import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  css: {
    postcss: {},
  },
  test: {
    globals: true,
    clearMocks: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "e2e/scripts/**/*.{test,spec}.{ts,mts}",
      "scripts/**/*.{test,spec}.{ts,mts}",
    ],
    // Exclude Playwright specs and their helpers; keep e2e/scripts/ tests in scope.
    exclude: [
      "node_modules",
      ".next",
      "out",
      "build",
      "e2e/tests/**",
      "e2e/auth/**",
      "e2e/mocks/**",
      "e2e/fixtures/**",
      "e2e/__snapshots__/**",
      // Browser-mode a11y primitive specs — run via pnpm a11y:primitives (vitest.a11y.config.mts).
      "src/**/__a11y__/**",
    ],
    css: false,
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "json"],
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/contexts/**",
        "src/app/api/**",
        "src/app/services/page.tsx",
      ],
      exclude: [
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/**/types/**",
        "src/components/ui/**",
        "src/**/__tests__/fixtures/**",
        // Test fixture data, not product code. It lives under src/lib/ only so
        // the e2e-mock route handler and the Playwright override bundles can
        // both import one source of truth, so `include`'s "src/lib/**" swept it
        // in and its near-total coverage inflated every metric above.
        "src/lib/e2e-fixtures/**",
      ],
      // Floors set just below the measured baseline so unrelated PRs don't
      // randomly trip on rounding drift. Bump these incrementally as new tests
      // raise the measured numbers; never lower them. When these were last
      // raised, `pnpm test:coverage` measured lines 88.38, statements 87.08,
      // functions 91.78, branches 78.81 — each floor sits 1-2 points under its
      // measurement, which absorbs drift without leaving the several-point gap
      // the previous floors had accumulated.
      //
      // These percentages describe ONLY the server/library subset `include`
      // names above. All of src/components/** except the ui/** exclusion is
      // outside the measurement, so a high number here says nothing about the
      // UI layer. Adding the component layer is a separate, separately
      // baselined coverage-policy change — do not widen `include` and reuse
      // these floors.
      thresholds: {
        lines: 87,
        statements: 86,
        functions: 90,
        branches: 77,
      },
    },
  },
});
