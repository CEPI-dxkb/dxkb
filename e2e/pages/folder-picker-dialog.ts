import { expect, type Locator, type Page } from "@playwright/test";

/** What the strip looked like on each animation frame after a key press. */
export interface StripTrace {
  /** `scrollLeft`, rounded, just before the key. */
  before: number;
  /** `scrollLeft`, rounded: once after the commit, then one entry per frame. */
  scrollLeft: number[];
  /** `scrollWidth`, rounded: the content width that sizes the scroll bar's thumb. */
  scrollWidth: number[];
  /** Leaving-column copies on the overlay, right after the key. */
  ghostsDuring: number;
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
  /** Copies of leaving columns, playing their exit on the overlay after the strip. */
  readonly exitCopies: Locator;

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
    this.exitCopies = this.strip.locator("xpath=following-sibling::*[1]/*");
  }

  async open(): Promise<void> {
    await this.browseButton.click();
    await expect(this.dialog).toBeVisible();
    await this.settled();
  }

  /**
   * Wait for the dialog's finite animations (its zoom-in, a column fading in)
   * and the strip's scroll glide to finish, so measurements see the final
   * layout. Loading skeletons pulse forever, so infinite animations are left
   * out.
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
      // The glide sizes the strip's content inline until it ends.
      const content = dialog.querySelector<HTMLElement>(
        '[role="group"][aria-label="Folder columns"] > *',
      );
      while (content?.style.width) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
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
   * Press `key` on the focused row and record the strip once React has
   * committed (its layout effect sets up the motion, before anything paints),
   * then on each of `frames` animation frames.
   *
   * The frames are stepped in the page, 16ms at a time, rather than drawn:
   * headless WebKit on Linux can take longer than the whole 180ms glide to
   * draw one real frame of this dialog, too few to see the glide. For the
   * trace, `requestAnimationFrame` callbacks wait for the next step and
   * `performance.now` reads the stepped time; both are put back afterwards.
   * The columns' fades run on the document timeline instead, so they are
   * finished at the commit: left running in real time, they would fall out of
   * step with the glide (a column still sliding in widens the strip after the
   * glide ends).
   */
  async pressAndTrace(key: string, frames = 14): Promise<StripTrace> {
    await this.settled();
    return this.strip.evaluate(
      async (strip, { key, frames }) => {
        const overlay = strip.nextElementSibling;
        const pending = new Map<number, FrameRequestCallback>();
        let lastId = 0;
        let now = performance.now();
        const realRequestFrame = window.requestAnimationFrame.bind(window);
        const realCancelFrame = window.cancelAnimationFrame.bind(window);
        performance.now = () => now;
        window.requestAnimationFrame = (callback) => {
          lastId += 1;
          pending.set(lastId, callback);
          return lastId;
        };
        window.cancelAnimationFrame = (id) => {
          pending.delete(id);
        };
        try {
          const before = Math.round(strip.scrollLeft);
          const target = document.activeElement ?? strip;
          target.dispatchEvent(
            new KeyboardEvent("keydown", { key, bubbles: true }),
          );
          // React flushes a keydown's update in a microtask; a task later the
          // commit and its layout effect have run.
          await new Promise<void>((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {
              resolve();
            };
            channel.port2.postMessage(null);
          });
          const trace = {
            before,
            scrollLeft: [Math.round(strip.scrollLeft)],
            scrollWidth: [Math.round(strip.scrollWidth)],
            ghostsDuring: overlay?.childElementCount ?? 0,
          };
          for (const element of [strip, overlay]) {
            for (const fade of element?.getAnimations({ subtree: true }) ??
              []) {
              if (fade.effect?.getTiming().iterations !== Infinity) {
                fade.finish();
              }
            }
          }
          for (let frame = 0; frame < frames; frame += 1) {
            now += 16;
            const due = [...pending.values()];
            pending.clear();
            for (const callback of due) callback(now);
            // Let promise work queued by the frame run, as it would between
            // real frames.
            await Promise.resolve();
            trace.scrollLeft.push(Math.round(strip.scrollLeft));
            trace.scrollWidth.push(Math.round(strip.scrollWidth));
          }
          return trace;
        } finally {
          Reflect.deleteProperty(performance, "now");
          window.requestAnimationFrame = realRequestFrame;
          window.cancelAnimationFrame = realCancelFrame;
          // Whatever the frames left waiting runs on real frames.
          for (const callback of pending.values()) {
            realRequestFrame(callback);
          }
        }
      },
      { key, frames },
    );
  }
}
