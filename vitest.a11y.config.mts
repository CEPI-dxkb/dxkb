import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";

// Browser-mode config for a11y primitives (`pnpm a11y:primitives`): jsdom
// cannot compute CSS custom properties, so contrast checks need real
// Chromium. Excluded from `pnpm test` and coverage.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("src", import.meta.url).pathname,
      "@public": new URL("public", import.meta.url).pathname,
    },
  },
  test: {
    name: "browser-a11y",
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    include: ["src/**/__a11y__/*.a11y.test.{ts,tsx}"],
    globals: true,
  },
});
