import { expect, type Locator, type Page } from "@playwright/test";

/** The site navbar's menus: the Services mega-menu and the search scope picker. */
export class Navbar {
  constructor(private readonly page: Page) {}

  /** Opens the Services menu and returns its panel once it is visible. */
  async openServicesMenu(): Promise<Locator> {
    await this.page
      .getByRole("button", { name: "Services" })
      .filter({ visible: true })
      .first()
      .click();
    const panel = this.page.locator('[data-slot="navigation-menu-content"]');
    await expect(panel).toBeVisible();
    return panel;
  }

  /** Opens the search box's scope picker and returns its list once visible. */
  async openSearchScope(): Promise<Locator> {
    await this.page
      .getByRole("combobox", { name: "Search type" })
      .filter({ visible: true })
      .first()
      .click();
    const list = this.page.getByRole("listbox").filter({ visible: true });
    await expect(list).toBeVisible();
    return list;
  }

  /** Closes whichever menu is open. */
  async closeMenu(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
