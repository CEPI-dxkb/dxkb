import type { Page, Request } from "@playwright/test";
import {
  uiPreferenceDefinitions,
  type UiPreferenceKey,
} from "@/lib/ui-preferences/definitions";
import { awaitPanelLayoutCommitted } from "../a11y/settle";
import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  journeyOverrides,
  taxonomyScenarioOverrides,
  workspaceOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

/**
 * A hydration mismatch or an unhandled error must fail the journey, not scroll past
 * in the console. Same shape as the helper in workspace-browse.spec.ts; each spec
 * keeps its own listener.
 */
function failOnRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return () => {
    expect(errors, "page emitted runtime errors").toEqual([]);
  };
}

/**
 * Next prefetches each in-viewport `<Link>` with a `?_rsc=` request, a few at a time
 * and after hydration. A hard navigation (`page.goto`, `page.reload`) cancels whatever
 * is still in flight, and WebKit reports each cancelled fetch as an unhandled
 * "due to access control checks" TypeError, which `failOnRuntimeErrors` rightly fails
 * on. `networkidle` does not close that gap (a prefetch can start after 500ms of
 * quiet), so track the prefetches from the start of the test and wait for the links
 * the page is about to abandon instead of hiding the error.
 */
function trackPrefetches(page: Page) {
  const inFlight = new Set<Request>();
  const settledPaths = new Set<string>();
  const isPrefetch = (request: Request) => request.url().includes("?_rsc=");
  const settle = (request: Request) => {
    if (!isPrefetch(request)) return;
    inFlight.delete(request);
    settledPaths.add(new URL(request.url()).pathname);
  };
  page.on("request", (request) => {
    if (isPrefetch(request)) inFlight.add(request);
  });
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  // Each document prefetches its own links; earlier pages' entries say nothing about it.
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    inFlight.clear();
    settledPaths.clear();
  });

  /** Wait until no prefetch is in flight and every in-viewport link matching `selector` has had one. */
  return async function awaitPrefetchesSettled(selector: string) {
    await expect
      .poll(
        async () => {
          if (inFlight.size > 0) return false;
          const paths = await page.locator(selector).evaluateAll((anchors) =>
            anchors
              .filter((anchor) => {
                const { top, bottom } = anchor.getBoundingClientRect();
                return bottom > 0 && top < window.innerHeight;
              })
              .map((anchor) => new URL((anchor as HTMLAnchorElement).href).pathname),
          );
          return paths.length > 0 && paths.every((path) => settledPaths.has(path));
        },
        { message: `prefetches for ${selector} did not settle`, timeout: 15_000 },
      )
      .toBe(true);
  };
}

async function panelWidths(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-panel]")].map((panel) =>
      Math.round(panel.getBoundingClientRect().width),
    ),
  );
}

/** Sub-pixel rounding can move a restored panel by a pixel; anything more is a reset. */
async function expectDetailsWidth(page: Page, expected: number) {
  await expect
    .poll(async () => Math.abs((await panelWidths(page))[1] - expected))
    .toBeLessThanOrEqual(2);
}

/**
 * The preference cookie is written from an effect after the state commits, which
 * lands a few milliseconds after the click or drag that caused it returns. A
 * navigation issued straight away can beat it and load the default, so wait until
 * the browser holds the cookie, as a user's next page load would.
 */
async function awaitPreferenceCookie(page: Page, key: UiPreferenceKey) {
  const { cookieName } = uiPreferenceDefinitions[key];
  await expect
    .poll(async () =>
      (await page.context().cookies()).some(({ name }) => name === cookieName),
    )
    .toBe(true);
}

async function dragSeparator(page: Page, deltaX: number) {
  const box = await page.locator("[data-separator]").first().boundingBox();
  if (!box) throw new Error("separator not rendered");
  const y = box.y + Math.min(box.height / 2, 200);
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + deltaX, y, { steps: 10 });
  await page.mouse.up();
}

test.describe("UI preferences survive a refresh (signed in)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
  });

  test("workspace details panel keeps its dragged width", async ({ page }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await page.goto("/workspace/e2e-test-user@patricbrc.org/home");
    await awaitPanelLayoutCommitted(page);
    await page.getByTitle("Show details panel").click();
    await awaitPanelLayoutCommitted(page);
    const [, before] = await panelWidths(page);
    await dragSeparator(page, -300);
    const [, dragged] = await panelWidths(page);
    expect(dragged).toBeGreaterThan(before + 200);
    await awaitPreferenceCookie(page, "workspacePanelLayout");

    await page.reload();
    await awaitPanelLayoutCommitted(page);
    await page.getByTitle("Show details panel").click();
    await expectDetailsWidth(page, dragged);
    assertNoRuntimeErrors();
  });

  test("jobs details panel keeps its dragged width", async ({ page }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await page.goto("/jobs");
    await expect(page.locator("[data-separator]").first()).toBeVisible();
    await awaitPanelLayoutCommitted(page);
    const [, before] = await panelWidths(page);
    await dragSeparator(page, -200);
    const [, dragged] = await panelWidths(page);
    expect(dragged).toBeGreaterThan(before + 100);
    await awaitPreferenceCookie(page, "jobsPanelLayout");

    await page.reload();
    await awaitPanelLayoutCommitted(page);
    await expectDetailsWidth(page, dragged);
    assertNoRuntimeErrors();
  });
});

test.describe("view rail remembers it was collapsed (public)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspaceOverrides,
        ...genomeScenarioOverrides,
        ...taxonomyScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("stays collapsed on another route's server render and after a refresh", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    const awaitPrefetchesSettled = trackPrefetches(page);
    await page.goto("/organisms/bacteria");
    await page
      .getByRole("button", { name: "Collapse view navigation" })
      .click();
    await awaitPreferenceCookie(page, "viewNavCollapsed");
    await awaitPrefetchesSettled('a[href^="/taxonomy/"]');

    await page.goto("/taxonomy/11520");
    await expect(
      page.getByRole("button", { name: "Expand view navigation" }),
    ).toBeVisible();
    await awaitPrefetchesSettled('a[href^="/taxonomy/"]');

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Expand view navigation" }),
    ).toBeVisible();
    assertNoRuntimeErrors();
  });
});
