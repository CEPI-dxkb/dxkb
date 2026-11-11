import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeBrowserScenarioOverrides,
  genomeFeatureScenarioOverrides,
  genomeScenarioOverrides,
  genomeSequenceScenarioOverrides,
} from "../fixtures/overrides";
import {
  GenomeBrowserPanelPage,
  GenomeMemberPage,
  Navbar,
  ThemeSwitcher,
} from "../pages";
import { failOnRuntimeErrors } from "../support/runtime-errors";
import { expectUrlParams } from "../support/url-params";

const overrides = [
  ...genomeBrowserScenarioOverrides,
  ...genomeScenarioOverrides,
  ...genomeFeatureScenarioOverrides,
  ...genomeSequenceScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Genome Browser", () => {
  // JBrowse errors must fail the journey. Known exception: tearing an engine down after
  // its feature dialog opened logs a formatDetails error, so no journey navigates away
  // from an open dialog.
  let assertNoRuntimeErrors: () => void;

  test.beforeEach(async ({ page }) => {
    assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await applyBackendMocks(page, { overrides: [...overrides] });
  });

  test.afterEach(() => {
    assertNoRuntimeErrors();
  });

  test("a genome opens on its first sequence and the URL follows the view", async ({
    page,
  }) => {
    const browser = new GenomeBrowserPanelPage(page);
    const dataRequests = browser.recordDataRequests();
    const features = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/genome-browser/features" &&
        url.searchParams.get("annotation") === "PATRIC" &&
        url.searchParams.get("refName") === "JX869059"
      );
    });
    await page.goto("/genome/1282460.2049?tab=genome-browser");
    await browser.expectLoaded();
    await features;
    expect(await browser.openTracks()).toEqual([
      "refseqs",
      "PATRICGenes",
      "RefSeqGenes",
    ]);
    await expect(browser.track("RefSeq Annotation")).toBeVisible();
    await expect(page).toHaveURL(/browser\.loc=JX869059:1\.\.30119/);
    await expectUrlParams(page, { "browser.tracks": null });

    await browser.expectViewFillsHost();

    await browser.goTo("JX869059:1000..2000");
    await expect(page).toHaveURL(/browser\.loc=JX869059:1000\.\.2000/);

    await dataRequests.expectRead("sequence");
    await browser.goTo("JX869059:1000..1100");
    await expect(page).toHaveURL(/browser\.loc=JX869059:1000\.\.1100/);
    await expectUrlParams(page, { "browser.tracks": null });

    dataRequests.expectWellFormedRanges();
  });

  test("a feature opens framed by 3 kb and highlighted", async ({ page }) => {
    const browser = new GenomeBrowserPanelPage(page);
    const dataRequests = browser.recordDataRequests();
    await page.goto(
      "/feature/PATRIC.1282460.2049.JX869059.CDS.1.100.fwd?tab=genome-browser",
    );
    await browser.expectLoaded();
    await expect(page).toHaveURL(/browser\.loc=JX869059:1\.\.3100/);
    await expect(page).toHaveURL(/browser\.highlight=JX869059:1\.\.100/);
    await dataRequests.expectRead("features");
    dataRequests.expectWellFormedRanges();
  });

  test("a feature whose highlight was cleared stays unhighlighted", async ({
    page,
  }) => {
    const browser = new GenomeBrowserPanelPage(page);
    await page.goto(
      "/feature/PATRIC.1282460.2049.JX869059.CDS.1.100.fwd?tab=genome-browser&browser.highlight=none",
    );
    await browser.expectLoaded();
    await expect(page).toHaveURL(/browser\.loc=JX869059:1\.\.3100/);
    await expectUrlParams(page, { "browser.highlight": "none" });
  });

  test("a legacy Genome Browser link keeps its location and tracks", async ({
    page,
  }) => {
    await page.goto(
      "/view/Genome/1282460.2049#view_tab=browser&loc=JX869059%3A1..5000&tracks=refseqs%2CPATRICGenes&highlight=",
    );
    // `canonicalizeMemberTabQuery` re-appends `tab` last, so check each param.
    await expect(page).toHaveURL(/\/genome\/1282460\.2049\?/);
    await expect(page).toHaveURL(/[?&]tab=genome-browser(?:&|$)/);
    await expect(page).toHaveURL(/[?&]browser\.loc=JX869059:1\.\.5000(?:&|$)/);
    await expect(page).toHaveURL(
      /[?&]browser\.tracks=refseqs,PATRICGenes(?:&|$)/,
    );
    const browser = new GenomeBrowserPanelPage(page);
    await browser.expectLoaded();
    expect(await browser.openTracks()).toEqual(["refseqs", "PATRICGenes"]);
  });

  test("editing the reference sequence track's settings does not throw", async ({
    page,
  }) => {
    const browser = new GenomeBrowserPanelPage(page);
    await page.goto(
      "/genome/1282460.2049?tab=genome-browser&browser.tracks=refseqs",
    );
    await browser.expectLoaded();
    const translation = await browser.toggleTrackMenuCheckbox(
      "refseqs",
      ["Show"],
      "Translation",
    );
    await expect(translation).toHaveAttribute("aria-checked", "false");
    // JBrowse saves edited track settings 400 ms later and the error is the only sign,
    // so wait past the save before afterEach checks.
    await page.waitForTimeout(1000);
  });

  test("the navbar's menus draw over the browser's sticky header", async ({
    page,
  }) => {
    const browser = new GenomeBrowserPanelPage(page);
    await page.goto("/genome/1282460.2049?tab=genome-browser");
    await browser.expectLoaded();

    // JBrowse's header z-index (825-850) beats the z-50 portalled popups unless the
    // wrapper isolates.
    const navbar = new Navbar(page);
    const services = await navbar.openServicesMenu();
    expect(await browser.headerPointsAbove(services)).toBe(0);
    await navbar.closeMenu();
    await expect(services).toBeHidden();

    const scope = await navbar.openSearchScope();
    expect(await browser.headerPointsAbove(scope)).toBe(0);
  });

  test("switching tabs drops the browser's URL state", async ({ page }) => {
    await page.goto(
      "/genome/1282460.2049?tab=genome-browser&browser.loc=JX869059:1..5000",
    );
    await new GenomeBrowserPanelPage(page).expectLoaded();
    await new GenomeMemberPage(page).openTab("Sequences");
    await expect(page).toHaveURL(/\?tab=sequences$/);
    await expect(page.getByTestId("app-ready-marker")).toHaveCount(0);
  });

  test("a theme switch rebuilds the browser with the new theme's colors at the same location", async ({
    page,
  }) => {
    const browser = new GenomeBrowserPanelPage(page);
    const dataRequests = browser.recordDataRequests();
    await page.goto("/genome/1282460.2049?tab=genome-browser");
    await browser.expectLoaded();
    await browser.goTo("JX869059:1000..2000");
    await expect(page).toHaveURL(/browser\.loc=JX869059:1000\.\.2000/);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "dxkb-light",
    );
    const light = await browser.expectPaintedWithAppliedTheme();

    await new ThemeSwitcher(page).chooseMode("dark");

    // The remount builds JBrowse from the tokens on <html> by then; an engine built
    // from the light tokens would keep painting light.
    const dark = await browser.expectPaintedWithAppliedTheme();
    expect(dark.background).not.toBe(light.background);
    expect(dark.card).not.toBe(light.card);
    await browser.expectLoaded();
    // The URL alone cannot show it (the old engine wrote it before the switch); the new
    // engine's location box can.
    await browser.expectLocation("JX869059:1000..2000");
    await expect(page).toHaveURL(/browser\.loc=JX869059:1000\.\.2000/);
    dataRequests.expectWellFormedRanges();
  });
});
