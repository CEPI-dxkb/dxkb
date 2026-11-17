import { expect, type Locator, type Page } from "@playwright/test";

export interface StripTrace {
  before: number;
  scrollLeft: number[];
  scrollWidth: number[];
  ghostsDuring: number;
}

export interface FolderPickerDialogOptions {
  browseButton?: Locator;
}

/**
 * Visible only, so React's hidden staged copy of a streamed selector cannot
 * shift the order.
 */
export function browseButtonFor(page: Page, placeholder: string): Locator {
  return page
    .locator("[data-workspace-selector]")
    .filter({ has: page.getByPlaceholder(placeholder, { exact: true }) })
    .getByRole("button", { name: /^Browse workspace (folders|files)$/ })
    .filter({ visible: true });
}

export function selectorInputFor(page: Page, placeholder: string): Locator {
  return page
    .locator("[data-workspace-selector]")
    .getByPlaceholder(placeholder, { exact: true })
    .filter({ visible: true });
}

/** A pointer held down on a resize handle. */
export interface DragInProgress {
  moveBy(dx: number, dy?: number, steps?: number): Promise<void>;
  release(): Promise<void>;
}

export class FolderPickerDialog {
  readonly page: Page;
  readonly browseButton: Locator;
  readonly dialog: Locator;
  readonly places: Locator;
  readonly strip: Locator;
  readonly toolbar: Locator;
  readonly newFolderButton: Locator;
  readonly uploadButton: Locator;
  readonly breadcrumb: Locator;
  readonly selectButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly showFilesButton: Locator;
  readonly exitCopies: Locator;

  constructor(
    page: Page,
    title = "Select an Output Folder",
    options: FolderPickerDialogOptions = {},
  ) {
    this.page = page;
    this.browseButton =
      options.browseButton ??
      page.getByRole("button", { name: "Browse workspace folders" });
    this.dialog = page.getByRole("dialog", { name: title });
    this.places = this.dialog.getByRole("navigation", { name: "Places" });
    this.strip = this.dialog.getByRole("group", { name: "Folder columns" });
    this.toolbar = this.dialog.getByRole("group", { name: "Folder actions" });
    this.newFolderButton = this.toolbar.getByRole("button", {
      name: "New folder here",
    });
    this.uploadButton = this.toolbar.getByRole("button", {
      name: "Upload here",
    });
    this.breadcrumb = this.dialog.getByRole("navigation", {
      name: /^Selected (folder|file)$/,
    });
    this.selectButton = this.dialog.getByRole("button", {
      name: /^Select( “.*”)?$/,
    });
    this.cancelButton = this.dialog.getByRole("button", { name: "Cancel" });
    this.closeButton = this.dialog.getByRole("button", { name: "Close" });
    this.showFilesButton = this.dialog.getByRole("button", {
      name: /^(Show|Hide) (other )?files$/,
    });
    this.exitCopies = this.strip.locator("xpath=following-sibling::*[1]/*");
  }

  async open(): Promise<void> {
    await this.browseButton.click();
    await expect(this.dialog).toBeVisible();
    await this.settled();
  }

  /** Loading skeletons pulse forever, so only finite animations are awaited. */
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

  column(label: string): Locator {
    return this.dialog.getByRole("listbox", { name: label });
  }

  option(column: string, name: string | RegExp): Locator {
    return this.column(column).getByRole("option", {
      name,
      exact: typeof name === "string",
    });
  }

  fileOption(column: string, name: string): Locator {
    return this.column(column)
      .getByRole("option")
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

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

  /** The info pane: the handle's parent, the box whose width the handle sets. */
  infoPane(): Locator {
    return this.infoPaneHandle().locator("xpath=..");
  }

  /** The info pane's vertical scroller: the box that carries its scrollbar. */
  infoScroller(): Locator {
    return this.infoPane().locator(".scrollbar-themed");
  }

  /** The dialog's right edge: a drag moves it by twice the pointer travel, because the dialog is centred. */
  dialogWidthHandle(): Locator {
    return this.dialog.getByRole("separator", { name: "Resize dialog width" });
  }

  /** The pointer-only bottom-right corner grip, which resizes both axes (hidden from assistive technology). */
  dialogGrip(): Locator {
    return this.dialog.locator('[data-slot="picker-resize-grip"]');
  }

  expandButton(): Locator {
    return this.dialog.getByRole("button", { name: "Expand dialog" });
  }

  restoreButton(): Locator {
    return this.dialog.getByRole("button", { name: "Restore dialog size" });
  }

  /**
   * The size on screen right now, with no wait for animations. The popup sets its size
   * with `transition-none`, so a resize shows in full the moment its input returns; a
   * gliding size would read as the old one here, which is what the "follows the
   * pointer" spec relies on.
   */
  async dialogSize(): Promise<{ width: number; height: number }> {
    const box = await this.dialog.boundingBox();
    if (!box) throw new Error("Dialog has no layout box");
    return { width: Math.round(box.width), height: Math.round(box.height) };
  }

  async dialogWidth(): Promise<number> {
    return (await this.dialogSize()).width;
  }

  async dialogHeight(): Promise<number> {
    return (await this.dialogSize()).height;
  }

  async breadcrumbLabels(): Promise<string[]> {
    return this.breadcrumb.getByRole("button").allTextContents();
  }

  async width(locator: Locator): Promise<number> {
    return locator.evaluate((element) => (element as HTMLElement).offsetWidth);
  }

  /**
   * Presses the pointer on the handle's centre and returns the drag in progress, so a spec
   * can read the page between moves. `moveBy` is measured from the press point, not from
   * the last move.
   */
  async beginDrag(handle: Locator): Promise<DragInProgress> {
    const box = await handle.boundingBox();
    if (!box) throw new Error("Resize handle has no layout box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    return {
      moveBy: (dx, dy = 0, steps = 1) =>
        this.page.mouse.move(x + dx, y + dy, { steps }),
      release: () => this.page.mouse.up(),
    };
  }

  async dragHandle(handle: Locator, dx: number, dy = 0): Promise<void> {
    const drag = await this.beginDrag(handle);
    await drag.moveBy(dx, dy, 8);
    await drag.release();
  }

  async scrollLeft(): Promise<number> {
    return this.strip.evaluate((strip) => Math.round(strip.scrollLeft));
  }

  /**
   * The frames are stepped in the page 16ms at a time because headless WebKit
   * on Linux can take longer than the 180ms glide to draw one real frame;
   * `requestAnimationFrame` and `performance.now` are patched and restored.
   * Column fades run on the document timeline, so they are finished at the
   * commit.
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
          // React flushes a keydown's update in a microtask.
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
            await Promise.resolve();
            trace.scrollLeft.push(Math.round(strip.scrollLeft));
            trace.scrollWidth.push(Math.round(strip.scrollWidth));
          }
          return trace;
        } finally {
          Reflect.deleteProperty(performance, "now");
          window.requestAnimationFrame = realRequestFrame;
          window.cancelAnimationFrame = realCancelFrame;
          for (const callback of pending.values()) {
            realRequestFrame(callback);
          }
        }
      },
      { key, frames },
    );
  }
}
