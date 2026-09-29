import type { Locator, Page, Request } from "@playwright/test";
import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  taxonomyScenarioOverrides,
  workspaceOverrides,
} from "../../fixtures/overrides";
import { OrganismLandingPage, TaxonPage } from "../../pages";
import { failOnRuntimeErrors } from "../../support/runtime-errors";

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

  /** Wait until no prefetch is in flight and every in-viewport link in `links` has had one. */
  return async function awaitPrefetchesSettled(links: Locator) {
    await expect
      .poll(
        async () => {
          if (inFlight.size > 0) return false;
          const paths = await links.evaluateAll((anchors) =>
            anchors
              .filter((anchor) => {
                const { top, bottom } = anchor.getBoundingClientRect();
                return bottom > 0 && top < window.innerHeight;
              })
              .map((anchor) => new URL((anchor as HTMLAnchorElement).href).pathname),
          );
          return paths.length > 0 && paths.every((path) => settledPaths.has(path));
        },
        { message: `prefetches for ${String(links)} did not settle`, timeout: 15_000 },
      )
      .toBe(true);
  };
}

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
    const landing = new OrganismLandingPage(page);
    const taxon = new TaxonPage(page);
    await landing.goto("bacteria");
    await landing.viewNav.collapse();
    await awaitPrefetchesSettled(landing.taxonomyLinks);

    await taxon.goto("11520");
    await expect(taxon.viewNav.expandButton).toBeVisible();
    await awaitPrefetchesSettled(taxon.taxonomyLinks);

    await page.reload();
    await expect(taxon.viewNav.expandButton).toBeVisible();
    assertNoRuntimeErrors();
  });
});
