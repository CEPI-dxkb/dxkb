import { expect, type Locator, type Page } from "@playwright/test";

import { awaitPanelLayoutCommitted } from "../a11y/settle";

/**
 * The main/details split (react-resizable-panels) the workspace and jobs
 * shells render; the details panel is the second `data-panel`.
 */
export class PanelSplit {
  readonly page: Page;
  readonly separator: Locator;
  private readonly panelList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.separator = page.locator("[data-separator]").first();
    this.panelList = page.locator("[data-panel]");
  }

  async settle(): Promise<void> {
    await awaitPanelLayoutCommitted(this.page);
  }

  async detailsWidth(): Promise<number> {
    const widths = await this.panelList.evaluateAll((panels) =>
      panels.map((panel) => Math.round(panel.getBoundingClientRect().width)),
    );
    return widths[1] ?? 0;
  }

  async dragSeparator(deltaX: number): Promise<void> {
    const box = await this.separator.boundingBox();
    if (!box) throw new Error("separator not rendered");
    const y = box.y + Math.min(box.height / 2, 200);
    await this.page.mouse.move(box.x + box.width / 2, y);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + deltaX, y, { steps: 10 });
    await this.page.mouse.up();
  }

  /**
   * Sub-pixel rounding can move a restored panel by a pixel; more is a reset.
   */
  async expectDetailsWidth(expected: number): Promise<void> {
    await expect
      .poll(async () => Math.abs((await this.detailsWidth()) - expected))
      .toBeLessThanOrEqual(2);
  }
}
