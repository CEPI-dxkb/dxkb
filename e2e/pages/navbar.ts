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

  // The visible header's height in px (both headers are in the DOM and CSS shows one).
  async height(): Promise<number | undefined> {
    return (await this.header().boundingBox())?.height;
  }

  // Controls in the visible header smaller than `min` px in either direction (WCAG 2.5.8
  // target size), as "<name> <w>x<h>". It measures every matching control, including clipped or
  // `inert` ones (the closed mobile search row's submit button reports its full layout size), and
  // skips only elements of 1px or less. `skip` is a CSS selector for controls to leave out.
  async controlsSmallerThan(min: number, skip?: string): Promise<string[]> {
    return this.header().evaluate(
      (header, args) => {
        const controls = header.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, [role='button'], [role='combobox']",
        );
        return Array.from(controls).flatMap((el) => {
          if (args.skip && el.matches(args.skip)) return [];
          const { width, height } = el.getBoundingClientRect();
          // Base UI draws a hidden 1px input beside its switches and radios: nothing to operate.
          // This also drops `display: none` controls (0x0), e.g. the desktop search bar below xl.
          if (width <= 1 || height <= 1) return [];
          if (width >= args.min && height >= args.min) return [];
          const name = el.getAttribute("aria-label") ?? el.innerText.trim().slice(0, 30);
          return [
            `${name || el.tagName} ${String(Math.round(width))}x${String(Math.round(height))}`,
          ];
        });
      },
      { min, skip },
    );
  }

  // The hamburger header's search toggle; its name flips to "Close search" once open.
  mobileSearchToggle(): Locator {
    return this.headerControl("button", /^(open|close) search$/i);
  }

  private headerControl(
    role: "link" | "button",
    name: string | RegExp,
  ): Locator {
    return this.header().getByRole(role, { name }).filter({ visible: true });
  }
}
