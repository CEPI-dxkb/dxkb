import type { Page } from "@playwright/test";

export interface SettleOptions {
  /**
   * Defaults to "networkidle"; use "domcontentloaded" on pages with
   * continuous RSC prefetch.
   */
  loadState?: "load" | "domcontentloaded" | "networkidle";
  extraMs?: number;
  skeletonSelector?: string;
  /** Defaults to true; a no-op on pages without a resize handle. */
  awaitPanelLayout?: boolean;
}

const panelGroupSelector = '[data-slot="resizable-panel-group"]';
const panelHandleSelector = '[data-slot="resizable-handle"]';

/**
 * Waits until every `ResizablePanelGroup` handle carries `aria-valuenow`,
 * that value matches the measured panel geometry (within 1.5pp), and geometry
 * is unchanged for a frame. Scanning earlier hits a critical
 * `aria-required-attr` on the server-rendered separator, and clicking earlier
 * loses the click when the toolbar shifts between mousedown and mouseup.
 */
export async function awaitPanelLayoutCommitted(
  page: Page,
  timeout = 15_000,
): Promise<void> {
  if ((await page.locator(panelGroupSelector).count()) === 0) return;
  await page.waitForFunction(
    ([handleSel, groupSel]) => {
      // A group with no handle counts as committed.
      if (!document.querySelector(groupSel)) return true;
      const handles = Array.from(document.querySelectorAll(handleSel));
      if (handles.length === 0) return true;

      // Panel extent as a fraction of the group's total panel extent (height
      // for vertical groups, width for horizontal).
      const extentOf = (el: Element, vertical: boolean) => {
        const box = el.getBoundingClientRect();
        return vertical ? box.height : box.width;
      };

      const signature: string[] = [];
      const agreed = handles.every((handle) => {
        const valueNow = handle.getAttribute("aria-valuenow");
        const controls = handle.getAttribute("aria-controls");
        if (valueNow === null || controls === null) return false;

        const group = handle.closest(groupSel);
        if (!group) return false;
        const vertical =
          getComputedStyle(group).flexDirection.startsWith("column");
        const panels = Array.from(group.querySelectorAll("[data-panel]"));
        const total = panels.reduce(
          (sum, panel) => sum + extentOf(panel, vertical),
          0,
        );
        if (total <= 0) return false;
        const target = panels.find((panel) => panel.id === controls);
        if (!target) return false;

        const measured = (extentOf(target, vertical) / total) * 100;
        signature.push(
          panels.map((p) => Math.round(extentOf(p, vertical))).join(","),
        );
        // 1.5pp absorbs rounding and subpixel layout.
        return Math.abs(Number(valueNow) - measured) <= 1.5;
      });
      if (!agreed) return false;

      // Same geometry two frames running, so a layout mid-flight cannot pass
      // on one frame.
      const w = window as unknown as { __panelLayoutSignature?: string };
      const current = signature.join("|");
      const stable = w.__panelLayoutSignature === current;
      w.__panelLayoutSignature = current;
      return stable;
    },
    [panelHandleSelector, panelGroupSelector] as const,
    { timeout, polling: "raf" },
  );
}

export async function awaitSettled(page: Page, options: SettleOptions = {}): Promise<void> {
  await page.waitForLoadState(options.loadState ?? "networkidle");
  await page.evaluate(() => document.fonts.ready);
  if (options.skeletonSelector) {
    await page.waitForSelector(options.skeletonSelector, { state: "detached", timeout: 10_000 });
  }
  if (options.awaitPanelLayout ?? true) {
    await awaitPanelLayoutCommitted(page);
  }
  if (options.extraMs) {
    await page.waitForTimeout(options.extraMs);
  }
}
