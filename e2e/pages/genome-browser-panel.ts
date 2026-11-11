import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The embedded JBrowse 5 view; readiness and open tracks come from its
 * `app-ready-marker` attributes, not canvas pixels.
 */
export class GenomeBrowserPanelPage {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("genome-browser");
  }

  readyMarker(): Locator {
    return this.root().getByTestId("app-ready-marker");
  }

  /**
   * Asserts the view's bottom edge is at the host's content-box bottom, which
   * only holds with the `.MuiScopedCssBaseline-root { height: 100% }` rule in
   * `globals.css`. Polls because layout can settle after the ready marker.
   */
  async expectViewFillsHost(): Promise<void> {
    await expect
      .poll(() =>
        this.root().evaluate((host) => {
          const view = host.querySelector('[data-testid="embedded-view-box"]');
          if (!view) return Number.NaN;
          const style = getComputedStyle(host);
          const contentBottom =
            host.getBoundingClientRect().bottom -
            Number.parseFloat(style.paddingBottom) -
            Number.parseFloat(style.borderBottomWidth);
          const gap = view.getBoundingClientRect().bottom - contentBottom;
          return Math.abs(gap) <= 1 ? 0 : Math.round(gap);
        }),
      )
      .toBe(0);
  }

  /**
   * Returns the points JBrowse's sticky header still wins over the popup, or
   * -1 when they do not overlap at all.
   */
  async headerPointsAbove(popup: Locator): Promise<number> {
    const popupBox = await popup.boundingBox();
    if (!popupBox) return -1;
    return this.root().evaluate((host, box) => {
      const header = [...host.querySelectorAll<HTMLElement>("*")].filter(
        (el) => {
          const style = getComputedStyle(el);
          return style.position === "sticky" && Number(style.zIndex) >= 800;
        },
      );
      let checked = 0;
      let above = 0;
      for (const band of header) {
        const rect = band.getBoundingClientRect();
        // Sample the middle of the band's overlap with the popup so a popup
        // covering only a band edge still counts.
        const top = Math.max(rect.top, box.y);
        const bottom = Math.min(rect.bottom, box.y + box.height);
        if (bottom <= top) continue;
        const y = (top + bottom) / 2;
        const left = Math.max(rect.left, box.x) + 8;
        const right = Math.min(rect.right, box.x + box.width) - 8;
        for (let x = left; x < right; x += 40) {
          checked += 1;
          if (band.contains(document.elementFromPoint(x, y))) above += 1;
        }
      }
      return checked === 0 ? -1 : above;
    }, popupBox);
  }

  locationBox(): Locator {
    return this.root().getByPlaceholder(/search for location/i);
  }

  track(name: string): Locator {
    return this.root().getByText(name, { exact: true });
  }

  async toggleTrackMenuCheckbox(
    trackId: string,
    submenus: readonly string[],
    checkbox: string,
  ): Promise<Locator> {
    await this.root()
      .getByTestId(`trackLabel-${trackId}`)
      .getByRole("button", { name: "Track settings" })
      .click();
    for (const submenu of submenus) {
      await this.page.getByRole("menuitem", { name: submenu }).click();
    }
    const item = this.page.getByRole("menuitemcheckbox", { name: checkbox });
    await item.click();
    return item;
  }

  async expectLoaded(): Promise<void> {
    await expect(this.readyMarker()).toHaveAttribute(
      "data-app-phase",
      "ready",
      { timeout: 30_000 },
    );
  }

  async openTracks(): Promise<string[]> {
    return JSON.parse(
      (await this.readyMarker().getAttribute("data-app-tracks")) ?? "[]",
    ) as string[];
  }

  async goTo(location: string): Promise<void> {
    await this.locationBox().fill(location);
    await this.locationBox().press("Enter");
  }

  async expectLocation(location: string): Promise<void> {
    await expect
      .poll(async () =>
        (await this.locationBox().inputValue()).replace(/(\d),(?=\d{3}\b)/g, "$1"),
      )
      .toBe(location);
  }

  /**
   * Call before the first navigation: the first reads happen while the view
   * builds.
   */
  recordDataRequests(): GenomeBrowserDataRequests {
    return new GenomeBrowserDataRequests(this.page);
  }

  async paintedSurfaces(): Promise<ThemeSurfaces> {
    return this.root().evaluate((root) => {
      const fill = (selector: string) => {
        const element = root.querySelector(selector);
        return element ? getComputedStyle(element).backgroundColor : "";
      };
      return {
        background: fill(".MuiScopedCssBaseline-root"),
        card: fill(".MuiPaper-outlined"),
      };
    });
  }

  /**
   * Computed styles keep `lab()`, so convert by painting one canvas pixel,
   * the route a color takes into MUI's palette.
   */
  async themeTokenSurfaces(): Promise<ThemeSurfaces> {
    return this.page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const styles = getComputedStyle(document.documentElement);
      const paint = (token: string) => {
        if (!context) return "";
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = styles.getPropertyValue(token).trim();
        context.fillRect(0, 0, 1, 1);
        const [red = 0, green = 0, blue = 0] = context.getImageData(
          0,
          0,
          1,
          1,
        ).data;
        return `rgb(${String(red)}, ${String(green)}, ${String(blue)})`;
      };
      return { background: paint("--background"), card: paint("--card") };
    });
  }

  async expectPaintedWithAppliedTheme(): Promise<ThemeSurfaces> {
    const tokens = await this.themeTokenSurfaces();
    await expect.poll(() => this.paintedSurfaces()).toEqual(tokens);
    return tokens;
  }
}

export interface ThemeSurfaces {
  background: string;
  card: string;
}

export class GenomeBrowserDataRequests {
  private readonly requests: URL[] = [];

  constructor(page: Page) {
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === "/api/genome-browser/features" ||
        url.pathname === "/api/genome-browser/sequence"
      ) {
        this.requests.push(url);
      }
    });
  }

  async expectRead(operation: "features" | "sequence"): Promise<void> {
    await expect
      .poll(() =>
        this.requests.some(
          (url) => url.pathname === `/api/genome-browser/${operation}`,
        ),
      )
      .toBe(true);
  }

  expectWellFormedRanges(): void {
    expect(this.requests.length, "no feature or sequence read was made").toBeGreaterThan(0);
    for (const url of this.requests) {
      // Digits only, as the route's `parseCoordinate` requires; `Number()`
      // would pass a missing start, `1e3` or `0x10`.
      const start = url.searchParams.get("start") ?? "";
      const end = url.searchParams.get("end") ?? "";
      expect(
        /^\d+$/.test(start) && /^\d+$/.test(end) && Number(end) > Number(start),
        url.href,
      ).toBe(true);
    }
  }
}
