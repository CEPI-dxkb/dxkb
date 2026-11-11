import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

// /api/data/search returns zero hits so /search renders "No results found"; both
// describe blocks navigate there.
const emptyDataApiResponse = Object.fromEntries(
  [
    "taxonomy", "genome", "strain", "genome_feature", "protein_feature",
    "epitope", "protein_structure", "surveillance", "serology", "experiment",
  ].map((type) => [
    type,
    { result: { response: { docs: [], numFound: 0, maxScore: 0, numFoundExact: true } } },
  ]),
);

const dataApiOverride = {
  url: /\/api\/data\/search$/,
  method: "POST",
  body: emptyDataApiResponse,
} as const;

test.describe("global search (keyboard journey)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
        dataApiOverride,
      ],
    });
  });

  test("typing in navbar search and pressing Enter routes to /search", async ({ page }) => {
    // Home hides the navbar SearchBar; /jobs is signed in and renders it.
    await page.goto("/jobs");

    const searchInput = page
      .getByPlaceholder(/search by virus name|protein|gene|taxonomy/i)
      .first();
    await expect(searchInput).toBeVisible();

    await searchInput.click();
    await page.keyboard.type("influenza");
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/search\?type=[^&]+&q=influenza$/, {
      timeout: 10_000,
    });
    expect(page.url()).toMatch(/q=influenza/);
    expect(page.url()).toMatch(/type=everything/);

    await expect(
      page.getByRole("heading", { level: 1, name: /results for influenza/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("No results found")).toBeVisible();
  });

  test("empty query submission does not navigate", async ({ page }) => {
    await page.goto("/jobs");
    const searchInput = page
      .getByPlaceholder(/search by virus name|protein|gene|taxonomy/i)
      .first();
    await searchInput.click();
    await page.keyboard.press("Enter");
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
    await expect(searchInput).toBeVisible();
  });
});

test.describe("command palette (Cmd+K)", () => {
  // The data_api mock is needed because the Enter test routes to /search, which fires a
  // Solr POST on mount.
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
        dataApiOverride,
      ],
    });
  });

  const modifierKey = process.platform === "darwin" ? "Meta" : "Control";

  async function openCommandPalette(page: import("@playwright/test").Page) {
    const dialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await page.keyboard.press(`${modifierKey}+K`);
      }
      await expect(dialog).toBeVisible();
    }).toPass({ timeout: 10_000 });
    return dialog;
  }

  // The CommandPalette listener attaches in a useEffect; retrying the shortcut avoids
  // racing hydration.
  test("Cmd/Ctrl+K opens the palette with an accessible name", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    await openCommandPalette(page);
  });

  test("Esc closes the palette", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    const dialog = await openCommandPalette(page);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("ArrowDown then Enter routes to a navigation item", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    await openCommandPalette(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/workspace\//, { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/workspace\//);
  });

  test("typing a query then Enter routes to /search", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    await openCommandPalette(page);

    await page.keyboard.type("influenza");

    await page.keyboard.press("Enter");

    await page.waitForURL(/\/search\?type=[^&]+&q=influenza$/, {
      timeout: 10_000,
    });
    expect(page.url()).toMatch(/q=influenza/);
    expect(page.url()).toMatch(/type=everything/);
  });

  test("clipboard paste fills the palette input", async ({ page, context, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Only Chromium accepts Playwright's clipboard-read/clipboard-write permissions; Firefox rejects them as unknown and WebKit's headless clipboard is unreliable",
    );

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    await openCommandPalette(page);

    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, "sars-cov-2");

    const pasteShortcut = process.platform === "darwin" ? "Meta+V" : "Control+V";
    await page.keyboard.press(pasteShortcut);

    const input = page.locator('[data-slot="command-input"]');
    await expect(input).toHaveValue("sars-cov-2");
  });
});
