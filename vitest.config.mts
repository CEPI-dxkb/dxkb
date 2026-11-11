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
        // Fixture data under src/lib/, excluded because its near-total
        // coverage inflated every metric.
        "src/lib/e2e-fixtures/**",
      ],
      // Floors sit 1-2 points under the measured baseline; raise them, never
      // lower them. They cover only the server/library subset `include`
      // names; widening to components needs its own baselined change.
      thresholds: {
        lines: 87,
        statements: 86,
        functions: 90,
        branches: 77,
      },
    },
  },
});
