import { expect, type Locator, type Page } from "@playwright/test";

/** What the strip looked like on each animation frame after a key press. */
export interface StripTrace {
  /** `scrollLeft`, rounded, just before the key. */
  before: number;
  /** `scrollLeft`, rounded: once after the commit, then one entry per frame. */
  scrollLeft: number[];
  /** `scrollWidth`, rounded: the content width that sizes the scroll bar's thumb. */
  scrollWidth: number[];
  /** Leaving-column copies on the overlay, right after the key and at the end. */
  ghostsDuring: number;
  ghostsAfter: number;
}

/**
 * Page object for the workspace folder picker (`WorkspaceFolderPickerDialog`),
 * opened from a service form's Output Folder field. Rows, columns and panes are
 * reached by role and accessible name; the strip's scroll state is read in the
 * page, frame by frame, because that is where the motion lives.
 */
export class FolderPickerDialog {
  readonly page: Page;
  readonly browseButton: Locator;
  readonly dialog: Locator;
  readonly places: Locator;
  readonly strip: Locator;
  readonly breadcrumb: Locator;
  readonly selectButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly showFilesButton: Locator;

  constructor(page: Page, title = "Select an Output Folder") {
    this.page = page;
    this.browseButton = page.getByRole("button", {
      name: "Browse workspace folders",
    });
    this.dialog = page.getByRole("dialog", { name: title });
    this.places = this.dialog.getByRole("navigation", { name: "Places" });
    this.strip = this.dialog.getByRole("group", { name: "Folder columns" });
    this.breadcrumb = this.dialog.getByRole("navigation", {
      name: "Selected folder",
    });
    this.selectButton = this.dialog.getByRole("button", {
      name: /^Select( “.*”)?$/,
    });
    this.cancelButton = this.dialog.getByRole("button", { name: "Cancel" });
    this.closeButton = this.dialog.getByRole("button", { name: "Close" });
    this.showFilesButton = this.dialog.getByRole("button", {
      name: /^(Show|Hide) files$/,
    });
  }

  async open(): Promise<void> {
    await this.browseButton.click();
    await expect(this.dialog).toBeVisible();
    await this.settled();
  }

  /**
   * Wait for the dialog's finite animations (its zoom-in, a column fading in)
   * to finish, so measurements see the final layout. Loading skeletons pulse
   * forever, so infinite animations are left out.
   */
  async settled(): Promise<void> {
    await this.dialog.evaluate(async (dialog) => {
      await Promise.all(
        dialog
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.dialog).toBeHidden();
  }

  /** The listbox of a column, named after the folder (or place) it lists. */
  column(label: string): Locator {
    return this.dialog.getByRole("listbox", { name: label });
  }

  option(column: string, name: string | RegExp): Locator {
    return this.column(column).getByRole("option", {
      name,
      exact: typeof name === "string",
    });
  }

  /** The whole column at a position, header and rows. */
  columnAt(index: number): Locator {
    return this.strip.locator(`[data-picker-column="${String(index)}"]`);
  }

  resizeHandle(columnLabel: string): Locator {
    return this.dialog.getByRole("separator", {
      name: `Resize ${columnLabel} column`,
    });
  }

  infoPaneHandle(): Locator {
    return this.dialog.getByRole("separator", { name: "Resize info pane" });
  }

  async breadcrumbLabels(): Promise<string[]> {
    return this.breadcrumb.getByRole("button").allTextContents();
  }

  /** Layout width in CSS pixels, unaffected by transforms such as the open zoom. */
  async width(locator: Locator): Promise<number> {
    return locator.evaluate((element) => (element as HTMLElement).offsetWidth);
  }

  /** Drag a resize handle sideways by `dx` pixels with the mouse. */
  async dragHandle(handle: Locator, dx: number): Promise<void> {
    const box = await handle.boundingBox();
    if (!box) throw new Error("Resize handle has no layout box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y, { steps: 8 });
    await this.page.mouse.up();
  }

  /** The strip's scroll position now. */
  async scrollLeft(): Promise<number> {
    return this.strip.evaluate((strip) => Math.round(strip.scrollLeft));
  }

  /**
   * Press `key` on the focused row and record the strip on every animation
   * frame for `ms`. The key is dispatched inside the page; the first sample is
   * taken once React has committed (its layout effect sets up the motion) but
   * before the next frame paints.
   */
  async pressAndTrace(key: string, ms = 360): Promise<StripTrace> {
    return this.strip.evaluate(
      async (strip, { key, ms }) => {
        const overlay = strip.nextElementSibling;
        const frame = () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        const before = Math.round(strip.scrollLeft);
        const target = document.activeElement ?? strip;
        target.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
        // React flushes a keydown's update in a microtask; a task later the
        // commit and its layout effect have run.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const scrollLeft = [Math.round(strip.scrollLeft)];
        const scrollWidth = [Math.round(strip.scrollWidth)];
        const ghostsDuring = overlay?.childElementCount ?? 0;
        const start = performance.now();
        while (performance.now() - start < ms) {
          await frame();
          scrollLeft.push(Math.round(strip.scrollLeft));
          scrollWidth.push(Math.round(strip.scrollWidth));
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          before,
          scrollLeft,
          scrollWidth,
          ghostsDuring,
          ghostsAfter: overlay?.childElementCount ?? 0,
        };
      },
      { key, ms },
    );
  }
}
