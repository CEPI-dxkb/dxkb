import type { Locator, Page } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  emptyBackendFallbackOverrides,
} from "../../fixtures/overrides";
import { ServiceFormPage } from "../../pages";

/**
 * Service form controls whose look depends on computed CSS, hover and
 * layout, which jsdom cannot evaluate: the shared disabled fill and cursor
 * (on fields, buttons and Base UI's span radios), a scrolled select's rounded
 * corners,
 * hover that skips disabled buttons, the number input's whole-field hover and
 * per-arrow highlight, the read-library header row, the Genome Alignment
 * advanced options grid, and the Gene/Protein Tree selected table's one-line
 * paths and content-wide Type column. The class-level halves are pinned by Vitest
 * (`src/components/ui/__tests__/disabled-state.test.tsx`,
 * `src/__tests__/theme-disabled-state.test.ts`).
 */

function style(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}

async function midline(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return (box?.y ?? 0) + (box?.height ?? 0) / 2;
}

/**
 * Waits for a collapsible panel's height animation to end. While the panel is
 * still shorter than its content, a click inside it scrolls the clipped
 * content into view (Playwright scrolls every scrollable ancestor), so every
 * position in the panel reads shifted until the animation ends and the
 * scroll snaps back.
 */
async function waitForPanelSettled(panel: Locator): Promise<void> {
  await expect
    .poll(() =>
      panel.evaluate(
        (element) =>
          element.getAnimations().length === 0 &&
          Math.abs(element.getBoundingClientRect().height - element.scrollHeight) < 1,
      ),
    )
    .toBe(true);
}

/** The computed color a custom property resolves to inside `scope`. */
function resolvedColor(scope: Locator, customProperty: string): Promise<string> {
  return scope.evaluate((element, name) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(${name})`;
    element.appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, customProperty);
}

/**
 * Turns transitions off, so a style read right after a hover sees the end
 * state rather than a color mid-fade (the fields and buttons `transition-all`).
 */
async function freezeTransitions(page: Page): Promise<void> {
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; }",
  });
}

/** Moves the pointer off every control, so no `:hover` applies. */
async function unhover(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
}

/**
 * Where a one-line text box's first drawn and last characters land, against
 * the box's own edges, and how wide its font draws "…" and the glyph just
 * before the first drawn one. Characters cut off keep their layout positions
 * in Chromium, past the box's left edge; WebKit reports them as empty boxes
 * where the drawn text starts.
 */
function textEdges(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const context = document.createElement("canvas").getContext("2d");
    if (context) context.font = getComputedStyle(element).font;
    const measure = (text: string) => context?.measureText(text).width ?? 0;
    const node = document
      .createTreeWalker(element, NodeFilter.SHOW_TEXT)
      .nextNode() as Text;
    const charBox = (index: number) => {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      return range.getBoundingClientRect();
    };
    let first = 0;
    while (first < node.length - 1) {
      const rect = charBox(first);
      if (rect.width > 0 && rect.left >= box.left - 0.5) break;
      first += 1;
    }
    return {
      left: box.left,
      right: box.right,
      height: box.height,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
      overflows: element.scrollWidth > element.clientWidth,
      ellipsis: measure("…"),
      hiddenGlyph: first > 0 ? measure(node.data[first - 1]) : 0,
      firstLeft: charBox(first).left,
      lastRight: charBox(node.length - 1).right,
    };
  });
}

/** The width of a cell's content, without its padding. */
function contentWidth(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().width;
  });
}

test.describe("service form controls", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("a disabled field takes the shared disabled fill and cursor; an editable one stays white", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, "Genome Annotation");
    await form.goto("/services/genome-annotation");

    const outputName = page
      .getByPlaceholder("Select Output Name...")
      .filter({ visible: true });
    const myLabel = page
      .getByPlaceholder("My identifier123")
      .filter({ visible: true });
    const taxonomyId = page.getByLabel("Taxonomy ID").filter({ visible: true });
    const card = page.locator('[data-slot="card"]').filter({ has: outputName });

    await expect(outputName).toBeDisabled();
    const disabledFill = await style(outputName, "background-color");
    expect(disabledFill).toBe(await resolvedColor(card, "--disabled"));
    // A step off the card, which a transparent fill used to melt into.
    expect(disabledFill).not.toBe(await style(card, "background-color"));
    expect(disabledFill).not.toBe(await style(myLabel, "background-color"));
    expect(await style(outputName, "cursor")).toBe("not-allowed");
    expect(await style(outputName, "opacity")).toBe("1");

    // Taxonomy ID is editable now, so it has the editable fields' fill.
    await expect(taxonomyId).toBeEnabled();
    expect(await style(taxonomyId, "background-color")).toBe(
      await style(myLabel, "background-color"),
    );
  });

  test("a disabled button shows the not-allowed cursor and keeps its fill on hover", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, /Genome Alignment/);
    await form.goto("/services/genome-alignment");
    await freezeTransitions(page);

    // Disabled until two genomes are selected.
    const submit = page.getByRole("button", { name: "Submit" });
    await expect(submit).toBeDisabled();
    await unhover(page);
    const restingFill = await style(submit, "background-color");

    await submit.hover({ force: true });

    expect(await style(submit, "cursor")).toBe("not-allowed");
    expect(await style(submit, "background-color")).toBe(restingFill);
  });

  test("a disabled radio dims and, with its label, shows the not-allowed cursor; an enabled one does neither", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, "Metagenomic Binning");
    await form.goto("/services/metagenomic-binning");

    // MetaSPAdes needs exactly one paired library, so it starts disabled.
    const metaspades = page.getByRole("radio", { name: "MetaSPAdes" });
    const megahit = page.getByRole("radio", { name: "MEGAHIT" });
    await expect(metaspades).toBeDisabled();
    await expect(megahit).toBeEnabled();

    await metaspades.hover({ force: true });
    expect(await style(metaspades, "cursor")).toBe("not-allowed");
    expect(await style(metaspades, "opacity")).toBe("0.5");
    expect(await style(megahit, "opacity")).toBe("1");
    expect(
      await style(page.getByText("MetaSPAdes", { exact: true }), "cursor"),
    ).toBe("not-allowed");
    expect(await style(megahit, "cursor")).not.toBe("not-allowed");
    expect(
      await style(page.getByText("MEGAHIT", { exact: true }), "cursor"),
    ).not.toBe("not-allowed");
  });

  test("enabling the seed weight opens its slider under the toggle without moving Weight", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, /Genome Alignment/);
    await form.goto("/services/genome-alignment");
    await page.getByRole("button", { name: "Advanced Options" }).click();

    const toggle = page.getByRole("switch", { name: "Manually Set Seed Weight" });
    const panel = page
      .locator('[data-slot="collapsible-content"]')
      .filter({ has: toggle });
    const weightInput = page
      .getByPlaceholder("Min pairwise LCB score")
      .filter({ visible: true });
    await expect(weightInput).toBeVisible();
    await waitForPanelSettled(panel);

    // The switch shares the Weight input's midline, and the two labels a row.
    expect(Math.abs((await midline(toggle)) - (await midline(weightInput)))).toBeLessThanOrEqual(1);
    const before = await weightInput.boundingBox();

    await toggle.click();
    const seedLabel = page.getByText("Seed Weight", { exact: true });
    await expect(seedLabel).toBeVisible();
    // The panel grows to fit the slider; measure once it has.
    await waitForPanelSettled(panel);

    expect(await weightInput.boundingBox()).toEqual(before);
    // The value sits level with its label (the label's margin used to drop it).
    const seedValue = seedLabel.locator("xpath=following-sibling::span[1]");
    await expect(seedValue).toHaveText("15");
    expect(
      Math.abs(
        ((await seedLabel.boundingBox())?.y ?? 0) -
          ((await seedValue.boundingBox())?.y ?? 0),
      ),
    ).toBeLessThanOrEqual(1);
  });

  test("a scrolled select's arrow strips keep the popup's rounded corners", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, "Subspecies Classification");
    await form.goto("/services/subspecies-classification");

    await page.getByRole("combobox", { name: "Species" }).click();
    const popup = page.locator('[data-slot="select-content"]');
    const list = popup.getByRole("listbox");
    await expect(list).toBeVisible();

    // Scrolled to the end, the scroll-up strip sits over the popup's top edge.
    // The popup does not clip it, so a square strip hid the rounded corners.
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const upArrow = popup.locator('[data-slot="select-scroll-up-button"]');
    await expect(upArrow).toBeVisible();
    const topRadius = await style(popup, "border-top-left-radius");
    expect(topRadius).not.toBe("0px");
    expect(await style(upArrow, "border-top-left-radius")).toBe(topRadius);
    expect(await style(upArrow, "border-top-right-radius")).toBe(
      await style(popup, "border-top-right-radius"),
    );

    // And the scroll-down strip over the bottom edge, scrolled back to the top.
    await list.evaluate((element) => {
      element.scrollTop = 0;
    });
    const downArrow = popup.locator('[data-slot="select-scroll-down-button"]');
    await expect(downArrow).toBeVisible();
    expect(await style(downArrow, "border-bottom-left-radius")).toBe(
      await style(popup, "border-bottom-left-radius"),
    );
    expect(await style(downArrow, "border-bottom-right-radius")).toBe(
      await style(popup, "border-bottom-right-radius"),
    );
  });

  test("a read-library header centers its label, rule and Add button on one line", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, "Genome Assembly");
    await form.goto("/services/genome-assembly");

    const header = page
      .locator(".service-library-header")
      .filter({ visible: true })
      .filter({ hasText: "Paired Read Library" });
    const label = header.getByText("Paired Read Library");
    const rule = header.locator(".service-library-divider");
    const add = header.getByRole("button", { name: "Add paired read library" });

    await expect(add).toHaveText("Add");
    await expect(add).toBeDisabled();
    const line = await midline(add);
    expect(Math.abs((await midline(label)) - line)).toBeLessThanOrEqual(1);
    expect(Math.abs((await midline(rule)) - line)).toBeLessThanOrEqual(1);
    // The rule is drawn, not the near-invisible --border it was.
    expect(await style(rule, "background-color")).not.toBe(
      await style(page.locator("body"), "border-color"),
    );
  });

  test("a number input hovers as one field and lights up only the hovered arrow", async ({
    page,
  }) => {
    const form = new ServiceFormPage(page, "Genome Assembly");
    await form.goto("/services/genome-assembly");
    await freezeTransitions(page);
    await page.getByRole("button", { name: "Advanced Options" }).click();

    // Racon Iterations: 0-4, starting at 2, so both arrows are enabled.
    const input = page.getByLabel("Racon Iterations").filter({ visible: true });
    const field = page
      .locator('[data-slot="number-input"]')
      .filter({ visible: true })
      .filter({ has: input });
    await expect(input).toHaveValue("2");
    const up = field.getByRole("button", { name: "Increase value" });
    const down = field.getByRole("button", { name: "Decrease value" });
    await expect(up).toBeEnabled();
    await expect(down).toBeEnabled();

    await unhover(page);
    const restBorder = await style(input, "border-top-color");
    const restArrowFill = await style(up, "background-color");
    const restArrowGlyph = await style(up, "color");

    await down.hover();

    // The border darkens all the way round, arrows included.
    const hoverBorder = await style(input, "border-top-color");
    expect(hoverBorder).not.toBe(restBorder);
    expect(await style(up, "border-top-color")).toBe(hoverBorder);
    expect(await style(down, "border-top-color")).toBe(hoverBorder);
    // Only the hovered arrow lights up, with the pointer.
    expect(await style(down, "background-color")).not.toBe(restArrowFill);
    expect(await style(down, "color")).not.toBe(restArrowGlyph);
    expect(await style(down, "cursor")).toBe("pointer");
    expect(await style(up, "background-color")).toBe(restArrowFill);
    expect(await style(up, "color")).toBe(restArrowGlyph);

    await down.click();
    await expect(input).toHaveValue("1");
  });

  test("a selected sequence's path keeps to one line, cut from the start, and Type is as wide as its label", async ({
    page,
  }) => {
    const longPath =
      "/e2e-test-user@patricbrc.org/home/Comprehensive Genome Analysis/.Haemophilus influenzae ERR7916262_Unicycler_test/.annotation/annotation.feature_dna.fasta";
    const shortPath = "/e2e-test-user@patricbrc.org/home/short.fa";
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(
      ([long, short]) => {
        sessionStorage.setItem(
          "e2e-rerun",
          JSON.stringify({
            alphabet: "DNA",
            sequences: [
              { filename: long, type: "feature_dna_fasta" },
              { filename: short, type: "aligned_dna_fasta" },
            ],
          }),
        );
      },
      [longPath, shortPath] as const,
    );
    const form = new ServiceFormPage(page, "Gene / Protein Tree");
    await form.goto("/services/gene-protein-tree?rerun_key=e2e-rerun");

    const long = page.getByTitle(longPath);
    const short = page.getByTitle(shortPath);
    await expect(long).toHaveText(longPath);
    await expect(short).toHaveText(shortPath);

    // The long path overflows yet its file name ends flush with the box, so
    // the start is what is cut. Nothing but the ellipsis comes before the
    // text (a `bdi` child left a gap there in WebKit), give or take the room
    // too narrow for the next glyph: WebKit cuts whole glyphs and leaves that
    // room at the box's edge, before the ellipsis (4px in CI's Linux build).
    const cut = await textEdges(long);
    expect(cut.height).toBeLessThanOrEqual(cut.lineHeight + 1);
    expect(cut.overflows).toBe(true);
    expect(Math.abs(cut.lastRight - cut.right)).toBeLessThanOrEqual(1);
    expect(cut.firstLeft - cut.left - cut.ellipsis).toBeLessThan(
      cut.hiddenGlyph + 1,
    );

    // A path that fits starts at the left edge, its leading "/" first.
    const whole = await textEdges(short);
    expect(whole.height).toBeLessThanOrEqual(whole.lineHeight + 1);
    expect(Math.abs(whole.firstLeft - whole.left)).toBeLessThanOrEqual(1);
    expect(whole.lastRight).toBeLessThan(whole.right);

    // Type is its widest label plus the cell padding (p-2 a side), no more.
    const type = page.getByRole("columnheader", { name: "Type" });
    const label = page.getByRole("cell", {
      name: "DNA Unaligned FASTA",
      exact: true,
    });
    const typeBox = await type.boundingBox();
    expect(typeBox).not.toBeNull();
    expect(
      (typeBox?.width ?? 0) - (await contentWidth(label)),
    ).toBeLessThanOrEqual(17);
  });
});
