import { expect, type Page } from "@playwright/test";

/**
 * The navbar's theme button for a signed-out visitor; signed-in users reach
 * the same options from the profile menu's Theme submenu.
 */
export class ThemeSwitcher {
  constructor(private readonly page: Page) {}

  async chooseMode(mode: "light" | "dark"): Promise<void> {
    await this.page.getByRole("button", { name: "Open theme selector" }).click();
    await this.page
      .getByRole("menuitemradio", { name: mode === "dark" ? "Dark" : "Light" })
      .click();
    await this.page.keyboard.press("Escape");
    await expect(this.page.locator("html")).toHaveAttribute(
      "data-theme",
      `dxkb-${mode}`,
    );
  }
}
