import { expect, type Locator, type Page } from "@playwright/test";

export class Navbar {
  constructor(private readonly page: Page) {}

  jobStatusPill(): Locator {
    return this.page.getByRole("button", { name: /view job status/i });
  }

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

  async closeMenu(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }
}
