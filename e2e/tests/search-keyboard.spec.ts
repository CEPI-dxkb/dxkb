import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";

// The plan called for Cmd/Ctrl+K command-palette coverage, but the only command
// palette in the repo (`src/components/search/command-search.tsx`) is dead code:
// it isn't mounted anywhere and binds Cmd+J to placeholder items. The real
// global search is the navbar `SearchBar` form, so this spec covers its
// keyboard-driven journey: focus → type → Enter → routed to /search?q=…, plus
// clipboard paste filling the input.
test.describe("global search (keyboard journey)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...permissiveBackendOverrides,
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
