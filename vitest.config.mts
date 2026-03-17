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
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "out", "build"],
    css: false,
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/contexts/**"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/**/types/**",
        "src/components/ui/**",
      ],
    },
  },
});
