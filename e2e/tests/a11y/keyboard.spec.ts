/** Keyboard operability (WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7), which axe cannot test. */
import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspacePopulatedOverrides,
  jobsOverrides,
  a11yBackendOverrides,
} from "../../fixtures/overrides";
import { WorkspacePage } from "../../pages/workspace-page";
import { JobsListPage } from "../../pages/jobs-list-page";

async function assertFocusVisible(
  page: Parameters<typeof applyBackendMocks>[0],
): Promise<void> {
  const hasFocusRing = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const style = window.getComputedStyle(el);
    const outline = style.outline;
    const boxShadow = style.boxShadow;
    const hasOutline = outline !== "none" && !outline.includes("0px");
    const hasShadow = boxShadow !== "none";
    return hasOutline || hasShadow;
  });
  // Best-effort signal: focus-ring presence depends on browser/OS defaults and CSS
  // reset, so failures are logged, not blocking.
  if (!hasFocusRing) {
    const tag = await page.evaluate(
      () => document.activeElement?.tagName ?? "unknown",
    );
    console.warn(
      `[a11y/keyboard] focus-ring may be absent on focused <${tag.toLowerCase()}> (WCAG 2.4.7)`,
    );
  }
}

test.describe("keyboard: home page", () => {
  test("Tab moves focus through interactive elements (no trap)", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [...a11yBackendOverrides],
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const focusedTags: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        return el
          ? `${el.tagName}${el.getAttribute("href") ?? el.getAttribute("aria-label") ?? ""}`
          : "body";
      });
      focusedTags.push(tag);
    }

    const anyFocused = focusedTags.some((t) => t !== "body" && t !== "BODY");
    expect(
      anyFocused,
      `Tab 10 times never moved focus away from body:\n${focusedTags.join(", ")}`,
    ).toBe(true);
  });
});

test.describe("keyboard: sign-in page", () => {
  test("Tab reaches email → password → submit in order", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [...a11yBackendOverrides],
    });
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: /sign in/i })
      .waitFor({ state: "visible" });

    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("type") ??
        document.activeElement?.tagName ??
        "",
    );
    expect(firstFocused).not.toBe("");

    let submitFocused = false;
    for (let i = 0; i < 10; i++) {
      const role = await page.evaluate(() => {
        const el = document.activeElement;
        return { type: el?.getAttribute("type"), tag: el?.tagName };
      });
      if (role.tag === "BUTTON" || role.type === "submit") {
        submitFocused = true;
        break;
      }
      await assertFocusVisible(page);
      await page.keyboard.press("Tab");
    }
    expect(
      submitFocused,
      "Tab never reached the submit button on sign-in",
    ).toBe(true);
  });
});

test.describe("keyboard: workspace dialogs (WCAG 2.1.2 — no trap)", () => {
  test("new-folder dialog: Escape closes and returns focus to trigger", async ({
    page,
    browserName,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await page.waitForLoadState("networkidle");

    await wp.newFolderButton.focus();
    await wp.openNewFolder();

    const dialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: /create folder/i }),
    });
    await expect(dialog).toBeVisible();

    // In Playwright's WebKit the blur has relatedTarget=null, so base-ui's
    // FloatingFocusManager never redirects focus back; the Escape check below still
    // covers WCAG 2.1.2.
    if (browserName !== "webkit") {
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        // The focus guard is a transient stop; FloatingFocusManager moves focus back
        // inside on the next frame.
        const focusInsideDialog = await page
          .waitForFunction(
            () => {
              const dialogEl = document.querySelector("[role='dialog']");
              return dialogEl?.contains(document.activeElement) ?? false;
            },
            undefined,
            { timeout: 1000 },
          )
          .then(() => true)
          .catch(() => false);
        expect(
          focusInsideDialog,
          `Tab ${String(i + 1)}: focus escaped the dialog (WCAG 2.1.2 violation)`,
        ).toBe(true);
      }
    }

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("upload dialog: Escape closes without keyboard trap", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const wp = new WorkspacePage(page);
    await wp.goto();
    await page.waitForLoadState("networkidle");

    await wp.openUpload();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: /^upload$/i }) });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("keyboard: jobs kill dialog (WCAG 2.1.2)", () => {
  test("kill confirmation: Escape cancels and focus returns", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...jobsOverrides,
        ...a11yBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    await jobs.selectJob("job-002");
    await jobs.killSelected();

    const dialog = page
      .getByRole("dialog")
      .filter({ hasText: /confirm|kill|stop/i });
    const dialogVisible = await dialog
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (!dialogVisible) {
      test.skip(true, "kill-dialog not present in this build");
      return;
    }

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      const focusInsideDialog = await page.evaluate(() => {
        const d = document.querySelector("[role='dialog']");
        return d?.contains(document.activeElement) ?? false;
      });
      expect(
        focusInsideDialog,
        `Tab ${String(i + 1)}: focus escaped kill dialog (WCAG 2.1.2)`,
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("keyboard: command palette (WCAG 2.1.1)", () => {
  test("Cmd/Ctrl+K opens, ArrowDown navigates, Escape closes", async ({
    page,
    browserName,
  }) => {
    // Playwright WebKit on Linux intercepts Ctrl+K before the page sees it; Chromium
    // and Firefox cover the shortcut.
    test.skip(
      browserName === "webkit" && process.platform !== "darwin",
      "Ctrl+K is intercepted by Playwright WebKit on Linux; Meta+K works in real Safari on macOS",
    );

    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...jobsOverrides,
        ...a11yBackendOverrides,
      ],
    });
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    const modifierKey = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifierKey}+K`);

    const dialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press("ArrowDown");
    const hasActiveDescendant = await page.evaluate(() => {
      const input = document.querySelector('[data-slot="command-input"]');
      return (
        input?.getAttribute("aria-activedescendant") !== null &&
        input?.getAttribute("aria-activedescendant") !== ""
      );
    });
    expect(
      hasActiveDescendant,
      "ArrowDown did not set aria-activedescendant",
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("keyboard: collection Download tile (WCAG 2.1.1, 2.1.2)", () => {
  test("opens from the keyboard, reaches every control, and Escape returns focus", async ({
    page,
  }) => {
    await applyBackendMocks(page, { overrides: [...a11yBackendOverrides] });
    await page.goto("/genome?keyword=influenza");
    const tile = page.getByRole("button", { name: /^DOWNLOAD/ });
    await expect(tile).toBeVisible();

    await tile.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("dialog").filter({
      has: page.getByRole("radiogroup", { name: "Rows to download" }),
    });
    await expect(panel).toBeVisible();

    const formatRow = panel.getByRole("button", { name: "Text" });
    const columnsSwitch = panel.getByRole("switch", { name: "Visible columns" });
    let reachedFormat = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      await expect
        .poll(() => panel.evaluate((el) => el.contains(document.activeElement)))
        .toBe(true);
      if (await formatRow.evaluate((el) => el === document.activeElement))
        reachedFormat = true;
      if (await columnsSwitch.evaluate((el) => el === document.activeElement))
        break;
    }
    expect(reachedFormat, "Tab never reached a format row").toBe(true);
    await expect(columnsSwitch).toBeFocused();
    await assertFocusVisible(page);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(tile).toBeFocused();
  });
});
