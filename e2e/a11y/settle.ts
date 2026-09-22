import type { Page } from "@playwright/test";

export interface SettleOptions {
  /**
   * Load state to wait for. Defaults to "networkidle".
   * Use "domcontentloaded" for pages with continuous RSC prefetch cycles
   * that prevent networkidle from ever being reached.
   */
  loadState?: "load" | "domcontentloaded" | "networkidle";
  /** Extra ms after load state + fonts.ready. For streaming/animated routes. */
  extraMs?: number;
  /** Selector that must detach before scanning (zero-skeleton contract). */
  skeletonSelector?: string;
  /**
   * Wait for the resizable shell to commit its layout before the page counts
   * as settled. See {@link awaitPanelLayoutCommitted}.
   */
  awaitPanelLayout?: boolean;
}

/** Selector for the shell's resizable panel group and its separator handle. */
const panelGroupSelector = '[data-slot="resizable-panel-group"]';
const panelHandleSelector = '[data-slot="resizable-handle"]';

/**
 * Wait until the `ResizablePanelGroup` has committed its client-side layout.
 *
 * Neither networkidle nor skeleton-detach covers layout that a *client effect*
 * commits after the data has landed. The workspace shell is the case in point:
 * `workspace-shell.tsx` server-renders the details panel at its `defaultSize`,
 * then a `useLayoutEffect` collapses it to zero because `panelExpanded` starts
 * false. That runs once react-resizable-panels' store has settled, which is
 * well after the fetches go quiet — measured at ~4.4s into the load under a
 * 20x CPU throttle, against an `awaitSettled()` that returned at ~3.2s.
 *
 * Two distinct CI failures come out of that one gap, which is why this lives in
 * `settle` rather than in either spec:
 *
 *   - Scanning early catches the separator before the group has assigned it an
 *     `aria-valuenow`. The server-rendered markup carries `role="separator"`
 *     with no value, so axe's `aria-required-attr` fires `critical` on a state
 *     that is gone a few hundred ms later.
 *   - Clicking early puts `mousedown` on a toolbar button and `mouseup`
 *     wherever that button used to be, because the collapse shifts the whole
 *     toolbar between the two (x=377 -> x=1094 in the reproduction). No
 *     `click` is synthesised at all, so the dialog never opens and the failure
 *     reads as "element(s) not found" against the *dialog* — pointing away
 *     from the layout that actually caused it.
 *
 * The post-condition is the commit itself, and the separator's `aria-valuenow`
 * is its one directly observable signal: react-resizable-panels computes that
 * value from the same store update that applies the collapse, so the attribute
 * appearing means the layout has been applied. Polling the group's own box
 * would prove nothing — it spans the viewport and never moves (`0,72,1280`
 * throughout) while its children reflow underneath. A fixed `extraMs` would
 * also mask both symptoms, but only while the pause happens to outlast the
 * commit.
 *
 * No-ops on pages with no panel group, so it is safe on any route.
 */
export async function awaitPanelLayoutCommitted(
  page: Page,
  timeout = 15_000,
): Promise<void> {
  if ((await page.locator(panelGroupSelector).count()) === 0) return;
  await page.waitForFunction(
    ([handleSel, groupSel]) => {
      // A group may legitimately render no handle (single panel); treat that as
      // committed rather than hanging until timeout.
      if (!document.querySelector(groupSel)) return true;
      const handles = document.querySelectorAll(handleSel);
      if (handles.length === 0) return true;
      return Array.from(handles).every((h) => h.hasAttribute("aria-valuenow"));
    },
    [panelHandleSelector, panelGroupSelector] as const,
    { timeout, polling: "raf" },
  );
}

/**
 * Wait for a stable page state before running axe:
 *   1. networkidle  — no in-flight requests for 500ms
 *   2. fonts.ready  — prevents false-positive contrast failures from unloaded fonts
 *   3. Skeleton gone — avoids scanning transient loading states
 *   4. Panel layout committed — avoids scanning (or clicking) mid-reflow
 */
export async function awaitSettled(page: Page, options: SettleOptions = {}): Promise<void> {
  await page.waitForLoadState(options.loadState ?? "networkidle");
  await page.evaluate(() => document.fonts.ready);
  if (options.skeletonSelector) {
    await page.waitForSelector(options.skeletonSelector, { state: "detached", timeout: 10_000 });
  }
  if (options.awaitPanelLayout) {
    await awaitPanelLayoutCommitted(page);
  }
  if (options.extraMs) {
    await page.waitForTimeout(options.extraMs);
  }
}
