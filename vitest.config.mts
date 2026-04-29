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
      ],
      // Floors set just below the measured baseline so unrelated PRs don't
      // randomly trip on rounding drift. Bump these incrementally as new tests
      // raise the measured numbers.
      thresholds: {
        lines: 81,
        statements: 80,
        functions: 84,
        branches: 70,
      },
    },
  },
});
