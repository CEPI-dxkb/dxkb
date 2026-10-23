import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The embedded JBrowse 5 view on a Genome or Feature View's Genome Browser
 * tab. Readiness and open tracks come from JBrowse's documented ready marker
 * (`[data-testid="app-ready-marker"]`: `data-app-phase`, `data-app-tracks`),
 * not from canvas pixels or label text.
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
   * The view fills the host's content box (the host's padding excluded): its
   * bottom edge sits at the host's content-box bottom. Not merely "stays
   * inside": the host has padding and the view's natural height can be shorter
   * than the host, so an inside-the-box check passes with or without the
   * `[data-slot="genome-browser"] .MuiScopedCssBaseline-root { height: 100% }`
   * rule in `globals.css`. Without it MUI's ScopedCssBaseline wrapper has no
   * height, and the view is content-height, either short of the host or
   * (spike item 2) spilling past it. Polls the gap in px, since the view's
   * layout can still settle after the ready marker.
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

  /** JBrowse's location search box. */
  locationBox(): Locator {
    return this.root().getByPlaceholder(/search for location/i);
  }

  track(name: string): Locator {
    return this.root().getByText(name, { exact: true });
  }

  /**
   * Open a track's settings menu, then each submenu in turn, and click the
   * checkbox item `checkbox`. Returns that item: JBrowse keeps the menu open
   * after a checkbox click, so its new state can be read.
   */
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

  /**
   * The engine on screen shows `location` (`ref:start..end`) in its location
   * box, digit grouping aside. Unlike the URL, which the previous engine wrote,
   * this is what the current one is actually showing.
   */
  async expectLocation(location: string): Promise<void> {
    await expect
      .poll(async () =>
        (await this.locationBox().inputValue()).replace(/(\d),(?=\d{3}\b)/g, "$1"),
      )
      .toBe(location);
  }

  /**
   * Start recording the browser's `features` and `sequence` reads. Call it
   * before the first navigation: the first reads happen while the view builds.
   */
  recordDataRequests(): GenomeBrowserDataRequests {
    return new GenomeBrowserDataRequests(this.page);
  }

  /**
   * The two surfaces of JBrowse's own MUI chrome that its theme maps from
   * `--background` (the scoped baseline's fill) and `--card` (a paper), as
   * the computed `rgb(...)` the browser paints them with.
   */
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
   * What the app's `--background` and `--card` tokens paint right now, as
   * `rgb(...)`. The tokens are not `rgb` in a computed style (the build keeps
   * `lab()`), so the browser converts them by painting one canvas pixel, the
   * same route a color takes into MUI's palette.
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

  /**
   * JBrowse is painted with the theme that is on `<html>` now. Polls, because
   * a theme switch remounts the browser: until the new engine has built, the
   * old (or no) chrome is what is on screen.
   */
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

/** The `features` and `sequence` reads the browser made, from the page's requests. */
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

  /** The browser has made at least one read of this kind. */
  async expectRead(operation: "features" | "sequence"): Promise<void> {
    await expect
      .poll(() =>
        this.requests.some(
          (url) => url.pathname === `/api/genome-browser/${operation}`,
        ),
      )
      .toBe(true);
  }

  /**
   * A guard that every request the adapters send is a well-formed range: a
   * start of 0 or more and an end past it. The route answers anything else
   * with a 400.
   */
  expectWellFormedRanges(): void {
    expect(this.requests.length, "no feature or sequence read was made").toBeGreaterThan(0);
    for (const url of this.requests) {
      // Digits only, as the route's `parseCoordinate` requires: `Number()`
      // alone would pass a missing start (0), `1e3` or `0x10`.
      const start = url.searchParams.get("start") ?? "";
      const end = url.searchParams.get("end") ?? "";
      expect(
        /^\d+$/.test(start) && /^\d+$/.test(end) && Number(end) > Number(start),
        url.href,
      ).toBe(true);
    }
  }
}
