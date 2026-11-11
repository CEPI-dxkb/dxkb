import { expect, describe, it, afterEach } from "vitest";
import { cleanup } from "vitest-browser-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  allThemes,
  applyTheme,
  renderWithTheme,
  runAxeOnContainer,
  formatBlockingViolations,
} from "@/test-helpers/render-with-theme";

// Sonner self-injects gray CSS and this harness has no Tailwind, so
// color-contrast is a false positive here; the e2e a11y sweep covers real toast
// contrast.
const axeOptions = { rules: { "color-contrast": { enabled: false } } } as const;

async function waitForToast(timeoutMs = 2000): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (document.querySelector("[data-sonner-toast]")) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("toast did not render within timeout");
}

describe("Toaster (sonner) — a11y primitive", () => {
  afterEach(async () => {
    toast.dismiss();
    await cleanup();
  });

  for (const theme of allThemes) {
    it(`success toast / ${theme} has no blocking violations`, async () => {
      await renderWithTheme(<Toaster />, theme);
      applyTheme(theme);
      toast.success("Upload complete", {
        description: "3 files uploaded to /home.",
      });
      await waitForToast();
      const { blocking, warnings } = await runAxeOnContainer(document.body, axeOptions);
      if (warnings.length > 0) {
        console.warn(`[a11y] Toaster/success/${theme}: ${String(warnings.length)} warn-tier`);
      }
      expect(
        blocking,
        blocking.length === 0 ? undefined : formatBlockingViolations(blocking, `Toaster/success/${theme}`),
      ).toEqual([]);
    });

    it(`error toast / ${theme} has no blocking violations`, async () => {
      await renderWithTheme(<Toaster />, theme);
      applyTheme(theme);
      toast.error("Upload failed", {
        description: "Network error — please retry.",
      });
      await waitForToast();
      const { blocking, warnings } = await runAxeOnContainer(document.body, axeOptions);
      if (warnings.length > 0) {
        console.warn(`[a11y] Toaster/error/${theme}: ${String(warnings.length)} warn-tier`);
      }
      expect(
        blocking,
        blocking.length === 0 ? undefined : formatBlockingViolations(blocking, `Toaster/error/${theme}`),
      ).toEqual([]);
    });
  }
});
