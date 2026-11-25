import { expect, type Locator, type Page } from "@playwright/test";

// What the header-wide measurements below count as a control.
const headerControls =
  "a[href], button, input, select, [role='button'], [role='combobox']";

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
  // skips only elements of 1px or less in both directions.
  async controlsSmallerThan(min: number): Promise<string[]> {
    return this.header().evaluate(
      (header, args) => {
        const controls = header.querySelectorAll<HTMLElement>(args.selector);
        return Array.from(controls).flatMap((el) => {
          const { width, height } = el.getBoundingClientRect();
          // Base UI draws a hidden 1px input beside its switches and radios: nothing to operate.
          // This also drops `display: none` controls (0x0), e.g. the desktop search bar below xl.
          // A control flex squeezes to nothing (0x40) still counts.
          if (width <= 1 && height <= 1) return [];
          if (width >= args.min && height >= args.min) return [];
          const name =
            el.getAttribute("aria-label") ?? el.innerText.trim().slice(0, 30);
          return [
            `${name || el.id || el.tagName} ${String(Math.round(width))}x${String(Math.round(height))}`,
          ];
        });
      },
      { min, selector: headerControls },
    );
  }

  // Controls in the visible header whose box reaches past either side of the viewport, as
  // "<name> <left>..<right>": a row too wide for the screen pushes them off it. It measures the
  // same controls as `controlsSmallerThan` and skips the same elements of 1px or less.
  async controlsOutsideViewport(): Promise<string[]> {
    return this.header().evaluate((header, selector) => {
      const controls = header.querySelectorAll<HTMLElement>(selector);
      const viewportWidth = document.documentElement.clientWidth;
      return Array.from(controls).flatMap((el) => {
        const { width, height, left, right } = el.getBoundingClientRect();
        if (width <= 1 && height <= 1) return [];
        if (left >= 0 && right <= viewportWidth) return [];
        const name =
          el.getAttribute("aria-label") ?? el.innerText.trim().slice(0, 30);
        return [
          `${name || el.id || el.tagName} ${String(Math.round(left))}..${String(Math.round(right))}`,
        ];
      });
    }, headerControls);
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
