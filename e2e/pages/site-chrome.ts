import { expect, type Locator, type Page } from "@playwright/test";

const siteFooterSelector = "[data-site-footer]";

/** Computed background colors; `footer` is null on a page without one. */
export interface SiteFills {
  root: string;
  body: string;
  footer: string | null;
}

/**
 * What every page shares around its content: the root element, the body and
 * the site footer (`<footer data-site-footer>`). Overscrolling past either
 * edge (macOS rubber-banding) shows the canvas, which paints the root's
 * background, so the root's fill is what the bounce shows.
 */
export class SiteChrome {
  readonly footer: Locator;

  constructor(private readonly page: Page) {
    this.footer = page.locator(siteFooterSelector);
  }

  async fills(): Promise<SiteFills> {
    return this.page.evaluate((selector) => {
      const fill = (element: Element) =>
        getComputedStyle(element).backgroundColor;
      const footer = document.querySelector(selector);
      return {
        root: fill(document.documentElement),
        body: fill(document.body),
        footer: footer ? fill(footer) : null,
      };
    }, siteFooterSelector);
  }

  /** The page ends in the site footer, and overscroll shows its fill. */
  async expectOverscrollInFooterFill(): Promise<void> {
    await expect(this.footer).toHaveCount(1);
    const { root, body, footer } = await this.fills();
    expect(root).toBe(footer);
    // The body keeps the page background over its own box.
    expect(body).not.toBe(footer);
  }

  /** Without the site footer, the root (and so the overscroll) is unpainted. */
  async expectOverscrollUnpainted(): Promise<void> {
    await expect(this.footer).toHaveCount(0);
    const { root } = await this.fills();
    expect(root).toBe("rgba(0, 0, 0, 0)");
  }
}
