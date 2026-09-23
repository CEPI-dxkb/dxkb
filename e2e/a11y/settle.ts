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
   * Wait for every resizable panel group to commit its layout before the page
   * counts as settled. See {@link awaitPanelLayoutCommitted}. Defaults to true:
   * every page that renders a resize handle has the gap, and the wait is a
   * no-op on pages that render none. It was opt-in once, and each workspace or
   * jobs route that had not opted in flaked on `aria-required-attr` under a
   * slow CI runner. Pass false only to observe a layout mid-commit on purpose.
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
 * The post-condition is the commit itself. Three conditions together stand in
 * for it, and the third is what makes the set sufficient:
 *
 *   1. Every handle carries `aria-valuenow`. react-resizable-panels computes
 *      that value from the same store update that applies a layout, so its
 *      absence means no layout has been applied yet.
 *   2. That value agrees with measured geometry — the `aria-controls` panel's
 *      share of the group's panel extent, within 1.5pp. Presence alone is the
 *      weaker claim: the library re-derives the attribute on every store
 *      update, including ones that *revert* a layout (a `ResizeObserver`
 *      callback arriving while `defaultLayoutDeferred` is still set discards
 *      the committed layout and recomputes from `defaultSize`). Agreement ties
 *      the attribute to the boxes the toolbar is actually positioned by.
 *   3. Geometry is unchanged from the previous animation frame, so a layout
 *      still in motion does not satisfy 1 and 2 mid-flight.
 *
 * Polling the group's own box would prove nothing — it spans the viewport and
 * never moves (`0,72,1280` throughout) while its children reflow underneath. A
 * fixed `extraMs` would mask both symptoms, but only while the pause happens to
 * outlast the commit.
 *
 * On the measured workspace load the collapse is a single DOM write: React
 * flushes the group's registration and the shell's collapse in one layout-effect
 * pass, so no 60/40 intermediate is ever written (0 such frames across 497
 * samples, at both 1x and 20x CPU throttle; the attribute and the collapsed
 * geometry appear together at ~249ms and ~4129ms respectively). Conditions 2
 * and 3 therefore cost nothing on the happy path — they remove the dependence
 * on that batching holding.
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
      // A group may legitimately render no handle (single panel, or a details
      // panel gated behind an expanded flag); treat that as committed rather
      // than hanging until timeout.
      if (!document.querySelector(groupSel)) return true;
      const handles = Array.from(document.querySelectorAll(handleSel));
      if (handles.length === 0) return true;

      // Panel extent along the group's main axis, as a fraction of the group's
      // total panel extent. Vertical groups size by height, horizontal by width.
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
        // A group with no measurable extent has not been laid out at all.
        if (total <= 0) return false;
        const target = panels.find((panel) => panel.id === controls);
        if (!target) return false;

        const measured = (extentOf(target, vertical) / total) * 100;
        signature.push(
          panels.map((p) => Math.round(extentOf(p, vertical))).join(","),
        );
        // 1.5pp absorbs the library's own rounding plus subpixel layout; it is
        // far tighter than the 60 -> 100 transitions this needs to exclude.
        return Math.abs(Number(valueNow) - measured) <= 1.5;
      });
      if (!agreed) return false;

      // Require the same geometry twice running, so a layout mid-flight cannot
      // satisfy the agreement check on a single frame and pass.
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
  if (options.awaitPanelLayout ?? true) {
    await awaitPanelLayoutCommitted(page);
  }
  if (options.extraMs) {
    await page.waitForTimeout(options.extraMs);
  }
}
