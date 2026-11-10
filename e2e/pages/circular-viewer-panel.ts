import { expect, type Locator, type Page } from "@playwright/test";
import { defaultTracks } from "@/lib/circular-viewer/tracks";

/**
 * The Genome View's Circular Viewer tab; rings are found by their
 * `data-track` group's radii. The figure is an `img` svg (hover, Export SVG)
 * inside the `application` wrapper that is the keyboard tab stop.
 */
export class CircularViewerPanelPage {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.getByTestId("circular-viewer");
  }

  figure(): Locator {
    return this.root().getByRole("img", { name: /^Circular view of genome / });
  }

  figureTabStop(): Locator {
    return this.root().getByRole("application", { name: /^Genome / });
  }

  ring(trackId: string): Locator {
    return this.figure().locator(`[data-track="${trackId}"]`);
  }

  trackRow(title: string): Locator {
    return this.root().getByRole("listitem", { name: title });
  }

  tooltip(): Locator {
    return this.root().getByRole("tooltip");
  }

  async goto(genomeId: string): Promise<void> {
    await this.page.goto(`/genome/${genomeId}?tab=circular-viewer`);
    await expect(this.figure()).toBeVisible();
  }

  async expectTrackReady(trackId: string): Promise<void> {
    await expect(this.ring(trackId)).toHaveAttribute("data-state", "ready");
  }

  async expectDefaultTracksSettled(): Promise<void> {
    for (const track of defaultTracks()) {
      await this.expectTrackReady(track.id);
    }
  }

  async ringPoint(
    trackId: string,
    angle: number,
  ): Promise<{ x: number; y: number }> {
    const ring = this.ring(trackId);
    const inner = Number(await ring.getAttribute("data-inner-radius"));
    const outer = Number(await ring.getAttribute("data-outer-radius"));
    // The mouse does not scroll: on a phone the sidebar sits above the figure.
    await this.figure().scrollIntoViewIfNeeded();
    const box = await this.figure().boundingBox();
    if (!box) throw new Error("The Circular Viewer figure has no layout box.");
    const radius = (inner + outer) / 2;
    return {
      x: box.x + box.width / 2 + radius * Math.sin(angle),
      y: box.y + box.height / 2 - radius * Math.cos(angle),
    };
  }

  async hoverRing(trackId: string, angle: number): Promise<void> {
    const { x, y } = await this.ringPoint(trackId, angle);
    await this.page.mouse.move(x, y);
  }

  async clickRing(trackId: string, angle: number): Promise<void> {
    const { x, y } = await this.ringPoint(trackId, angle);
    await this.page.mouse.click(x, y);
  }

  async chooseOption(trigger: string, option: string): Promise<void> {
    await this.root().getByRole("combobox", { name: trigger }).click();
    await this.page.getByRole("option", { name: option }).click();
  }

  async uploadUserTrack(
    plot: string,
    fileName: string,
    contents: string,
  ): Promise<void> {
    await this.chooseOption("Plot type", plot);
    // Through the real picker: "Choose file" opens the hidden input's.
    const chooser = this.page.waitForEvent("filechooser");
    await this.root().getByRole("button", { name: "Data file Choose file" }).click();
    await (await chooser).setFiles({
      name: fileName,
      mimeType: "text/tab-separated-values",
      buffer: Buffer.from(contents),
    });
    await expect(this.root().getByText(fileName, { exact: true })).toBeVisible();
    await this.root().getByRole("button", { name: "Add user track" }).click();
  }
}
