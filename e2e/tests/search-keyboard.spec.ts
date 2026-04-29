import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

// Two complementary keyboard surfaces ship together:
// - the navbar `SearchBar` form (focus → type → Enter → /search?q=…, plus
//   clipboard paste filling the input)
// - the global `<CommandPalette>` mounted in the root layout (Cmd/Ctrl+K
//   toggles open, arrow keys navigate, Enter routes, Esc closes).
test.describe("global search (keyboard journey)", () => {
  // p3.theseed.org/services/data_api/query/ — bulk multi-type Solr query fired by SearchResults on mount.
  // Returns zero hits for every type so the page renders the ResultsOverview card without errors.
  const emptyDataApiResponse = Object.fromEntries(
    [
      "taxonomy", "genome", "strain", "genome_feature", "sp_gene",
      "protein_feature", "epitope", "protein_structure", "pathway",
      "subsystem", "surveillance", "serology", "experiment",
      "antibiotics", "genome_sequence",
    ].map((type) => [
      type,
      { result: { response: { docs: [], numFound: 0, maxScore: 0, numFoundExact: true } } },
    ]),
  );

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Workspace.get (favorites) fired when /jobs loads the workspace sidebar chrome.
        // (AppService.enumerate_tasks_filtered is covered by jobsOverrides inside journeyOverrides.)
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
        // p3.theseed.org data_api bulk Solr query — fired by SearchResults when /search mounts.
        {
          url: /theseed\.org\/services\/data_api\/query/,
          method: "POST",
          body: emptyDataApiResponse,
        },
      ],
    });
  });

  test("typing in navbar search and pressing Enter routes to /search", async ({ page }) => {
    // Home hides the navbar SearchBar (welcome hero owns search there).
    // /jobs is signed-in and renders the navbar variant we want to drive.
    await page.goto("/jobs");

    const searchInput = page
      .getByPlaceholder(/search by virus name|protein|gene|taxonomy/i)
      .first();
    await expect(searchInput).toBeVisible();

    await searchInput.click();
    await page.keyboard.type("influenza");
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/search\?q=influenza(?:&searchtype=[^&]+)?$/, {
      timeout: 10_000,
    });
    expect(page.url()).toMatch(/q=influenza/);
    expect(page.url()).toMatch(/searchtype=everything/);

    // Beyond URL navigation, the /search page must actually render its results
    // region. A regression that breaks SearchResults rendering would still pass
    // the URL-only assertion above; this guards against that.
    // CardTitle renders as a <div data-slot="card-title">, not a <h*> element,
    // so we target the text directly.
    await expect(
      page.locator('[data-slot="card-title"]', { hasText: /search results/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("empty query submission does not navigate", async ({ page }) => {
    await page.goto("/jobs");
    const searchInput = page
      .getByPlaceholder(/search by virus name|protein|gene|taxonomy/i)
      .first();
    await searchInput.click();
    await page.keyboard.press("Enter");
    // SearchBar bails out of router.push() when input is empty.
    await expect(page).toHaveURL(/\/jobs/);
  });

  test("clipboard paste fills the navbar search input", async ({ page, context, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Only Chromium accepts Playwright's clipboard-read/clipboard-write permissions; Firefox rejects them as unknown and WebKit's headless clipboard is unreliable",
    );

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/jobs");

    const searchInput = page
      .getByPlaceholder(/search by virus name|protein|gene|taxonomy/i)
      .first();
    await searchInput.click();

    // Seed the system clipboard, then trigger a paste with the keyboard.
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, "sars-cov-2");

    const pasteShortcut = process.platform === "darwin" ? "Meta+V" : "Control+V";
    await page.keyboard.press(pasteShortcut);

    await expect(searchInput).toHaveValue("sars-cov-2");
  });

  test("Tab moves focus from search input without dismissing it", async ({ page }) => {
    await page.goto("/jobs");
    const searchInput = page
      .getByPlaceholder(/search by virus name|protein|gene|taxonomy/i)
      .first();
    await searchInput.click();
    await expect(searchInput).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(searchInput).not.toBeFocused();
    // Form is still in the DOM after Tab; Esc/blur should not unmount the search bar.
    await expect(searchInput).toBeVisible();
  });
});

test.describe("command palette (Cmd+K)", () => {
  // Command palette is mounted globally in the root layout, so any route
  // works; /jobs is signed-in and gives us the navbar/auth chrome we'd hit
  // in real usage.
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
  });

  const modifierKey = process.platform === "darwin" ? "Meta" : "Control";

  test("Cmd/Ctrl+K opens the palette with an accessible name", async ({ page }) => {
    await page.goto("/jobs");

    await page.keyboard.press(`${modifierKey}+K`);

    const dialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(dialog).toBeVisible();
  });

  test("Esc closes the palette", async ({ page }) => {
    await page.goto("/jobs");
    await page.keyboard.press(`${modifierKey}+K`);
    const dialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("ArrowDown then Enter routes to a navigation item", async ({ page }) => {
    await page.goto("/jobs");
    await page.keyboard.press(`${modifierKey}+K`);
    await expect(
      page.getByRole("dialog", { name: /command palette/i }),
    ).toBeVisible();

    // First Navigate item is "Home"; ArrowDown highlights it then Enter selects.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/$|\/(?:\?.*)?$/, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("typing a query then Enter routes to /search", async ({ page }) => {
    await page.goto("/jobs");
    await page.keyboard.press(`${modifierKey}+K`);
    await expect(
      page.getByRole("dialog", { name: /command palette/i }),
    ).toBeVisible();

    await page.keyboard.type("influenza");

    // The "Search for X" item is filtered to the top once the input has text;
    // pressing Enter selects it and the runSearch handler routes us to /search.
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/search\?q=influenza(?:&searchtype=[^&]+)?$/, {
      timeout: 10_000,
    });
    expect(page.url()).toMatch(/q=influenza/);
    expect(page.url()).toMatch(/searchtype=everything/);
  });

  test("clipboard paste fills the palette input", async ({ page, context, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Only Chromium accepts Playwright's clipboard-read/clipboard-write permissions; Firefox rejects them as unknown and WebKit's headless clipboard is unreliable",
    );

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/jobs");
    await page.keyboard.press(`${modifierKey}+K`);
    await expect(
      page.getByRole("dialog", { name: /command palette/i }),
    ).toBeVisible();

    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, "sars-cov-2");

    const pasteShortcut = process.platform === "darwin" ? "Meta+V" : "Control+V";
    await page.keyboard.press(pasteShortcut);

    // The CommandInput is the focused element after the palette opens.
    const input = page.locator('[data-slot="command-input"]');
    await expect(input).toHaveValue("sars-cov-2");
  });
});
