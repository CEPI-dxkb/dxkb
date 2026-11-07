import { mockAuspiceBasemap } from "../../fixtures/overrides/auspice-basemap";
import { authSessionOverrides } from "../../fixtures/overrides/auth-session";
import { workspaceRpcOverride } from "../../fixtures/overrides/workspace";
import dataset from "../../fixtures/overrides/organisms/phylogeny/auspice-tree-map-v2.json" with { type: "json" };
import { applyBackendMocks, expect, test } from "../../mocks/backends";
import { hasWebGl } from "../../support/webgl";

const familyUrl = /\/api\/content\/phyloxml_trees\/families\/2955291\/2955291\.json$/;
const datasetId = "Influenza-A-Virus/H3N2/HA";
const family = {
  order: ["h3n2", "h5n1"],
  groups: [
    {
      key: "h3n2",
      title: "H3N2",
      archaeopteryx: [{ name: "XML HA", path: "/test/h3n2-ha.xml" }],
      nextstrain: [
        { name: "H3N2 segment 4 (HA)", path: datasetId, region: "usa" },
        { name: "H3N2 segment 6 (NA)", path: "Influenza-A-Virus/H3N2/NA" },
      ],
    },
    {
      key: "h5n1",
      title: "H5N1",
      archaeopteryx: [{ name: "H5N1 segment 4 (HA)", path: "/test/h5n1-ha.xml" }],
      nextstrain: [],
    },
  ],
};

// Enough rows to overflow a desktop viewport, so the filter sidebar can be
// checked against a genuinely scrolled tree list. Each filler needs its own
// parseable segment — otherwise every tree collapses into a single (strain,
// segment) row instead of 24 separate scrollable ones.
const scrollFamily = {
  order: ["h3n2"],
  groups: [
    {
      key: "h3n2",
      title: "H3N2",
      archaeopteryx: Array.from({ length: 24 }, (_, index) => {
        const n = String(index + 1);
        return { name: `Filler tree ${n} (S${n})`, path: `/test/filler-${n}.xml` };
      }),
      nextstrain: [],
    },
  ],
};

async function mockAuspice(
  page: Parameters<typeof applyBackendMocks>[0],
  inventoryStatus = 200,
  familyBody: typeof family | typeof scrollFamily = family,
) {
  await applyBackendMocks(page, {
    overrides: [
      ...authSessionOverrides,
      workspaceRpcOverride("Workspace.get", { result: [[]] }),
      { url: familyUrl, body: familyBody },
      {
        url: "/api/phylogeny/nextstrain-datasets",
        status: inventoryStatus,
        body: inventoryStatus === 200 ? { ids: [datasetId] } : { error: "unavailable" },
      },
      { url: "/api/charon/getAvailable", body: { datasets: [], narratives: [] } },
      {
        url: /\/api\/charon\/getDataset\?.*type=(root-sequence|tip-frequencies|measurements)/,
        status: 404,
        body: { error: "dataset not found" },
      },
      {
        url: "/api/charon/getDataset",
        body: dataset,
      },
    ],
  });
  await mockAuspiceBasemap(page);
}

async function openPicker(page: Parameters<typeof applyBackendMocks>[0]) {
  await page.goto("/taxonomy/2955291?tab=phylogeny");
  const heading = page.getByRole("heading", { name: "Available phylogenetic trees" });
  try {
    await expect(heading).toBeVisible({ timeout: 1_000 });
  } catch {
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await page.getByRole("button", { name: /Views: Phylogeny/ }).click();
      await page
        .getByRole("dialog", { name: "Views" })
        .getByRole("button", { name: "Phylogeny" })
        .click();
    } else {
      await page.getByRole("button", { name: "Phylogeny" }).click();
    }
  }
  await expect(
    page.getByRole("heading", { name: "Available phylogenetic trees" }),
  ).toBeVisible();
}

function row(page: Parameters<typeof applyBackendMocks>[0], name: string) {
  return page.getByText(name, { exact: true }).locator("xpath=ancestor::*[@data-slot='tree-row']");
}

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(90_000);

test("opens the exact Auspice dataset and renders tree, map, and attribution", async ({ page }) => {
  await mockAuspice(page);
  const datasetRequests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname === "/api/charon/getDataset" && !url.searchParams.has("type")) {
      datasetRequests.push(url.searchParams.get("prefix") ?? "");
    }
  });
  const workerPaths: string[] = [];
  page.on("worker", worker => workerPaths.push(new URL(worker.url()).pathname));
  const tileRequests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.hostname === "tiles.openfreemap.org" && url.pathname.endsWith(".pbf")) {
      tileRequests.push(url.pathname);
    }
  });

  await openPicker(page);
  await page.getByRole("radio", { name: "Auspice" }).click();
  // Neither row has an Archaeopteryx tree for its segment, so both peer slots
  // there read dead regardless — the interesting contrast is on the Auspice side.
  const available = row(page, "H3N2 segment 4 (HA)").getByRole("button", {
    name: "Open H3N2 segment 4 (HA) in Auspice",
  });
  const missing = row(page, "H3N2 segment 6 (NA)").getByTitle("Auspice dataset is not available");
  await expect(available).toBeVisible();
  await expect(missing).toHaveText("Not Available");
  await available.click();

  const iframe = page.getByTitle("Auspice phylogeny viewer for H3N2 segment 4 (HA)");
  await expect(iframe).toHaveAttribute(
    "src",
    "/nextstrain-viewer/Influenza-A-Virus/H3N2/HA",
  );
  const viewer = page.frameLocator('iframe[title="Auspice phylogeny viewer for H3N2 segment 4 (HA)"]');
  await expect(viewer.getByText("Deterministic H3N2 Auspice tree", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(viewer.getByText("E2E-USA", { exact: true })).toBeVisible();
  await expect(viewer.getByText(/Powered by Nextstrain/)).toBeVisible();
  if (await hasWebGl(page)) {
    await expect(viewer.locator("#map")).toBeVisible();
    // MapLibre reads the credit from the style's sources once it loads; the
    // `attribution` passed beside the style is never shown.
    await expect(viewer.locator(".leaflet-control-attribution")).toContainText(
      "OpenStreetMap",
    );
    // MapLibre 6 cannot find its worker inside a webpack bundle, so
    // patches/auspice@3.2.0.patch emits it as a hashed /dist/ asset and hands
    // MapLibre that URL. Without a worker no tile is ever drawn.
    await expect
      .poll(() => workerPaths.some(path => /^\/dist\/[0-9a-f]+\.mjs$/.test(path)))
      .toBe(true);
    // The worker, not the page, fetches vector tiles, and only after MapLibre
    // asks it for one, so a tile request shows the worker loaded, started and
    // is answering MapLibre's messages. Drawing the tile is MapLibre's own job.
    await expect.poll(() => tileRequests.length).toBeGreaterThan(0);
  } else {
    // Without WebGL (headless Firefox in CI) Auspice drops the map panel and
    // keeps the tree.
    await expect(viewer.locator("#map")).toHaveCount(0);
  }
  expect(datasetRequests).toEqual([`nextstrain-viewer/${datasetId}`]);

  await page.getByRole("button", { name: /Back to trees/ }).click();
  await expect(iframe).toHaveCount(0);
  await expect(available).toBeFocused();
});

test("keeps the local Auspice viewer same-origin so it can fetch datasets", async ({ page }) => {
  await mockAuspice(page);
  const blockedRequests: string[] = [];
  page.on("requestfailed", request => {
    if (request.url().includes("/api/charon/")) blockedRequests.push(request.url());
  });

  await openPicker(page);
  await row(page, "H3N2 segment 4 (HA)")
    .getByRole("button", { name: "Open H3N2 segment 4 (HA) in Auspice" })
    .click();

  const iframe = page.getByTitle("Auspice phylogeny viewer for H3N2 segment 4 (HA)");
  await expect(iframe).not.toHaveAttribute("sandbox");
  await expect(
    page
      .frameLocator('iframe[title="Auspice phylogeny viewer for H3N2 segment 4 (HA)"]')
      .getByText("Deterministic H3N2 Auspice tree", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  expect(blockedRequests).toEqual([]);
});

test("nav bar logo and wordmark open the Auspice docs in a new tab", async ({ page, context }) => {
  // Stock Auspice hardcodes href="/" with no target on both (it assumes it owns
  // the site root), so a click navigates the iframe to the DXKB home page and
  // renders it nested inside the phylogeny panel. auspice/navbar.js replaces
  // that nav bar; this guards the extension staying wired up in the bundle.
  await mockAuspice(page);
  await openPicker(page);
  await page.getByRole("radio", { name: "Auspice" }).click();
  // Filtered to Auspice only, so the row's primary (and only) choice is the
  // nextstrain one — the row's display name matches the button we click.
  await row(page, "H3N2 segment 4 (HA)")
    .getByRole("button", { name: "Open H3N2 segment 4 (HA) in Auspice" })
    .click();

  const frameSelector = 'iframe[title="Auspice phylogeny viewer for H3N2 segment 4 (HA)"]';
  const viewer = page.frameLocator(frameSelector);
  await expect(viewer.getByText("Deterministic H3N2 Auspice tree", { exact: true })).toBeVisible({ timeout: 30_000 });

  const docsUrl = "https://docs.nextstrain.org/projects/auspice/";
  const wordmark = viewer.getByRole("link", { name: "auspice", exact: true });
  const logo = viewer.getByRole("link", { name: "Auspice documentation" });
  for (const link of [wordmark, logo]) {
    await expect(link).toHaveAttribute("href", docsUrl);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }

  // The regression is the iframe navigating away, so assert on where it ends up
  // rather than trusting the attributes alone.
  const popup = await Promise.all([
    context.waitForEvent("page"),
    wordmark.click(),
  ]).then(([opened]) => opened);
  expect(popup.url()).toContain("docs.nextstrain.org");
  await popup.close();

  await expect(page.locator(frameSelector)).toHaveAttribute(
    "src",
    `/nextstrain-viewer/${datasetId}`,
  );
  await expect(viewer.getByText("Deterministic H3N2 Auspice tree", { exact: true })).toBeVisible();
});

test("fails closed when inventory is unavailable", async ({ page }) => {
  await mockAuspice(page, 500);
  await openPicker(page);

  // "XML HA" has no parseable segment, so it lands in its own row separate
  // from the HA/NA nextstrain rows — Archaeopteryx is unaffected by inventory
  // failures either way.
  await expect(
    row(page, "H3N2 segment 4 (HA)").getByTitle(
      "Auspice dataset availability could not be confirmed",
    ),
  ).toHaveText("Availability Unconfirmed");
  await expect(
    row(page, "XML HA").getByRole("button", { name: "Open XML HA in Archaeopteryx" }),
  ).toBeVisible();
});

test("disables filter options with no matching trees", async ({ page }) => {
  await mockAuspice(page);
  await openPicker(page);

  // Base UI radios/checkboxes are spans with aria-disabled, not native inputs.
  const auspice = page.getByRole("radio", { name: /Auspice/ });
  await expect(auspice).not.toHaveAttribute("aria-disabled", "true");

  // H5N1 in this fixture is Archaeopteryx-only, HA-only.
  await page.getByRole("radio", { name: /H5N1/ }).click();
  await expect(auspice).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("radio", { name: /Archaeopteryx/ })).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("checkbox", { name: /^HA/ })).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("checkbox", { name: /^NA/ })).toHaveAttribute("aria-disabled", "true");

  // Disabled means inert, not just dimmed: Playwright's actionability check
  // refuses to click a control it considers disabled.
  await expect(auspice.click({ timeout: 2_000 })).rejects.toThrow(/not enabled/);
  await expect(auspice).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("H5N1 segment 4 (HA)")).toBeVisible();

  // ...and it must also *look* disabled. Base UI renders a span with
  // aria-disabled rather than a natively disabled control, so a `peer-disabled:`
  // style silently never applies — only computed style catches that.
  const rowOpacity = (name: RegExp) =>
    page.getByRole("radio", { name }).locator("xpath=ancestor::label[1]")
      .evaluate(element => Number(getComputedStyle(element).opacity));
  expect(await rowOpacity(/Auspice/)).toBeLessThan(1);
  expect(await rowOpacity(/Archaeopteryx/)).toBe(1);

  // Options are disabled, never removed: the segment list must not reflow.
  const segmentLabels = page.getByRole("checkbox").locator("xpath=ancestor::label[1]");
  const narrowed = await segmentLabels.count();
  await page.getByRole("radio", { name: /All strains/ }).click();
  expect(await segmentLabels.count()).toBe(narrowed);

  // Clearing the strain re-enables everything.
  await expect(auspice).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("checkbox", { name: /^NA/ })).not.toHaveAttribute("aria-disabled", "true");
});

test("keeps the filter sidebar pinned while the tree grid scrolls", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "geometry checks run in Chromium");
  await page.setViewportSize({ width: 1440, height: 800 });
  await mockAuspice(page, 200, scrollFamily);
  await openPicker(page);

  const filters = page.getByRole("button", { name: /Filters/ });
  // The picker is server-rendered inside the lazy tab's Suspense boundary, so a
  // hidden streamed copy can sit beside the live one.
  const grid = page.locator('[data-slot="tree-results-scroll"]').filter({ visible: true });
  await expect(filters).toBeVisible();

  const before = await filters.boundingBox();
  const scrolled = await grid.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return { scrollTop: element.scrollTop, scrollHeight: element.scrollHeight };
  });
  // Guards the fixture staying tall enough for the scroll to prove anything.
  expect(scrolled.scrollTop).toBeGreaterThan(0);
  const after = await filters.boundingBox();

  expect(after?.y).toBeCloseTo(before?.y ?? -1, 0);
  await expect(filters).toBeInViewport();
  // The page itself must not scroll — otherwise the sidebar leaves with it.
  const pageScroll = await page.evaluate(() => ({
    scrollY: window.scrollY,
    overflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(pageScroll.scrollY).toBe(0);
  expect(pageScroll.overflow).toBeLessThanOrEqual(1);
});

test("themes the sidebar collapse control clear of the scroll gutter", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "geometry checks run in Chromium");
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAuspice(page);
  await openPicker(page);
  await page.getByRole("radio", { name: "Auspice" }).click();
  await row(page, "H3N2 segment 4 (HA)")
    .getByRole("button", { name: "Open H3N2 segment 4 (HA) in Auspice" })
    .click();

  const viewer = page.frameLocator(
    'iframe[title="Auspice phylogeny viewer for H3N2 segment 4 (HA)"]',
  );
  await expect(viewer.getByText("Deterministic H3N2 Auspice tree", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // Reads through the same-origin iframe rather than a frameLocator so the
  // sidebar's scroll gutter — the thing the chevron used to sit on — can be
  // measured. offsetWidth-clientWidth is the only way to see it; no CSS
  // property reports it, which is why this cannot be a unit test.
  const probe = () =>
    page.locator('iframe[title^="Auspice phylogeny viewer"]').evaluate((element) => {
      const frame = element as HTMLIFrameElement;
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) throw new Error("Auspice iframe is not same-origin");
      const sidebar = doc.querySelector('[class*="SidebarContainer"]');
      const nav = doc.querySelector('[class*="NavBarContainer"]');
      if (!sidebar || !nav) throw new Error("Auspice sidebar chrome not mounted");
      const chevron = [...nav.children].find((child) =>
        child.getAttribute("style")?.includes("position: fixed"),
      );
      if (!chevron) throw new Error("sidebar chevron not mounted");
      const chevronBox = chevron.getBoundingClientRect();
      const styles = win.getComputedStyle(chevron);
      return {
        scheme: win.getComputedStyle(doc.documentElement).colorScheme,
        // Distance from the chevron's right edge to the sidebar's *content*
        // edge. The stock inline `left` puts this at -gutterWidth.
        gapToContentEdge:
          sidebar.getBoundingClientRect().left + sidebar.clientWidth - chevronBox.right,
        gutter: (sidebar as HTMLElement).offsetWidth - sidebar.clientWidth,
        width: Math.round(chevronBox.width),
        height: Math.round(chevronBox.height),
        radius: styles.borderRadius,
        background: styles.backgroundColor,
      };
    });

  // The bridge mirrors data-theme into the iframe, so driving the host's
  // attribute is enough — no reload, no re-key.
  const setTheme = (theme: string) =>
    page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
    }, theme);

  await setTheme("dxkb-dark");
  const dark = await probe();
  expect(dark.scheme).toBe("dark");
  expect(dark.gapToContentEdge).toBe(0);
  // Mirrors the collapsed tab in sidebar-toggle.js (14x44, rounded on the side
  // facing the panels). Auspice's own chevron is a bare 12px glyph.
  expect(dark.width).toBe(15);
  expect(dark.height).toBe(46);
  expect(dark.radius).toBe("6px 0px 0px 6px");

  // The gutter is the reason for the right-anchoring, so a run where the UA
  // draws an overlay scrollbar cannot prove the fix. Say so rather than pass
  // quietly.
  if (dark.gutter === 0) {
    console.warn("[auspice] overlay scrollbars: gutter overlap not exercised");
  }

  // Both halves of the theming: the tab must track the host tokens, and the UA
  // scrollbar must follow the host out of dark mode.
  await setTheme("dxkb-light");
  const light = await probe();
  expect(light.scheme).toBe("normal");
  expect(light.background).not.toBe(dark.background);
  expect(light.gapToContentEdge).toBe(0);

  // Collapsed state: same tab, mirrored. Two different upstream components, so
  // a change to one does not imply the other.
  await viewer.locator('[class*="NavBarContainer"] > div[style*="position: fixed"]').click();
  const collapsed = await page
    .locator('iframe[title^="Auspice phylogeny viewer"]')
    .evaluate((element) => {
      const doc = (element as HTMLIFrameElement).contentDocument;
      const win = (element as HTMLIFrameElement).contentWindow;
      if (!doc || !win) throw new Error("Auspice iframe is not same-origin");
      const toggle = doc.querySelector('div[style*="z-index: 9000"]');
      if (!toggle) throw new Error("collapsed sidebar toggle not mounted");
      const styles = win.getComputedStyle(toggle);
      return {
        visibility: styles.visibility,
        background: styles.backgroundColor,
        radius: styles.borderRadius,
        shadow: styles.boxShadow,
      };
    });
  expect(collapsed.visibility).toBe("visible");
  expect(collapsed.radius).toBe("0px 6px 6px 0px");
  // Stock is a hardcoded #F2F2F2 tab under a drop shadow.
  expect(collapsed.background).not.toBe("rgb(242, 242, 242)");
  expect(collapsed.shadow).toBe("none");
});

test("supports keyboard activation and mobile containment", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "detailed keyboard and geometry checks run in Chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuspice(page);
  await openPicker(page);
  await page.getByRole("radio", { name: "Auspice" }).click();

  const available = row(page, "H3N2 segment 4 (HA)").getByRole("button", {
    name: "Open H3N2 segment 4 (HA) in Auspice",
  });
  await available.focus();
  await page.keyboard.press("Enter");
  const iframe = page.getByTitle("Auspice phylogeny viewer for H3N2 segment 4 (HA)");
  await expect(iframe).toBeVisible();
  const geometry = await iframe.evaluate(element => {
    const frame = element.getBoundingClientRect();
    const root = document.documentElement;
    return {
      height: frame.height,
      right: frame.right,
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    };
  });
  expect(geometry.height).toBeGreaterThanOrEqual(600);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

  await page.getByRole("button", { name: /Back to trees/ }).click();
  await expect(available).toBeFocused();
  await page.keyboard.press("Space");
  await expect(iframe).toBeVisible();
});
