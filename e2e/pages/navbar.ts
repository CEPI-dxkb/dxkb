import { expect, type Locator, type Page } from "@playwright/test";

export class Navbar {
  constructor(private readonly page: Page) {}

  jobStatusPill(): Locator {
    return this.page.getByRole("button", { name: /view job status/i });
  }

  // Both navbars (desktop and mobile) are in the DOM and CSS shows one, so every
  // header-scoped locator below filters on visible and picks the one that is showing.
  header(): Locator {
    return this.page.getByRole("banner").first();
  }

  signInLink(): Locator {
    return this.headerControl("link", "Sign In");
  }

  signUpLink(): Locator {
    return this.headerControl("link", "Sign Up");
  }

  searchField(): Locator {
    return this.header().getByRole("textbox").filter({ visible: true });
  }

  advancedSearchButton(): Locator {
    return this.headerControl("button", "Advanced Search");
  }

  // The header's own job pill, as opposed to `jobStatusPill()`, which matches page-wide.
  headerJobPill(): Locator {
    return this.headerControl("button", /view job status/i);
  }

  accountMenu(): Locator {
    return this.headerControl("button", "Account menu");
  }

  async expectFullyInViewport(control: Locator): Promise<void> {
    await expect(control).toBeInViewport({ ratio: 1 });
  }

  async widthOf(control: Locator): Promise<number | undefined> {
    return (await control.boundingBox())?.width;
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

  private headerControl(
    role: "link" | "button",
    name: string | RegExp,
  ): Locator {
    return this.header().getByRole(role, { name }).filter({ visible: true });
  }
}
