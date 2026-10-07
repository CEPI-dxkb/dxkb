import {
  columnWidthLimitsFor,
  isInlineEditTarget,
  inlineEditAttribute,
  placeGroups,
  placeIcons,
  previewWidthLimits,
  rowSelector,
  tabStopSelector,
  uploadPaneMinWidth,
} from "@/components/workspace/folder-picker/folder-picker-utils";
import { pickerViewOptions } from "@/lib/services/workspace/picker-views";

describe("columnWidthLimitsFor", () => {
  it("starts the first column wider than the folder columns", () => {
    expect(columnWidthLimitsFor(0).initial).toBe(240);
    expect(columnWidthLimitsFor(1).initial).toBe(180);
    expect(columnWidthLimitsFor(5).initial).toBe(180);
  });

  it("gives every column the same range, with its default inside it", () => {
    for (const index of [0, 1, 2]) {
      const limits = columnWidthLimitsFor(index);
      expect(limits).toMatchObject({ min: 144, max: 480 });
      expect(limits.initial).toBeGreaterThanOrEqual(limits.min);
      expect(limits.initial).toBeLessThanOrEqual(limits.max);
    }
  });
});

describe("pane widths", () => {
  it("keeps the info pane's default and the upload form's minimum in range", () => {
    expect(previewWidthLimits.initial).toBeGreaterThanOrEqual(
      previewWidthLimits.min,
    );
    expect(uploadPaneMinWidth).toBeGreaterThan(previewWidthLimits.initial);
    expect(uploadPaneMinWidth).toBeLessThanOrEqual(previewWidthLimits.max);
  });
});

describe("places", () => {
  it("lists every place exactly once, each with an icon", () => {
    const views = placeGroups.flatMap((group) => group.views);

    expect([...views].sort()).toEqual(
      pickerViewOptions.map((option) => option.value).sort(),
    );
    for (const view of views) expect(placeIcons[view]).toBeDefined();
  });
});

describe("row selectors", () => {
  function row(column: number, path: string, tabIndex = -1) {
    const element = document.createElement("div");
    element.dataset.pickerRow = "";
    element.dataset.pickerCol = String(column);
    element.dataset.pickerPath = path;
    element.tabIndex = tabIndex;
    return element;
  }

  it("finds a row by column and path, even with quotes in the name", () => {
    const strip = document.createElement("div");
    const quoted = row(1, '/alice@bvbrc/home/say "hi"');
    strip.append(
      row(0, '/alice@bvbrc/home/say "hi"'),
      quoted,
      row(1, "/alice@bvbrc/home/other"),
    );

    expect(
      strip.querySelector(rowSelector(1, '/alice@bvbrc/home/say "hi"')),
    ).toBe(quoted);
  });

  it("finds the one row in the Tab order", () => {
    const strip = document.createElement("div");
    const stop = row(0, "/a/b", 0);
    strip.append(row(0, "/a/a"), stop, document.createElement("button"));

    expect(strip.querySelectorAll(tabStopSelector)).toHaveLength(1);
    expect(strip.querySelector(tabStopSelector)).toBe(stop);
  });
});

describe("isInlineEditTarget", () => {
  it("recognises the new-folder field and anything inside its marker", () => {
    const field = document.createElement("input");
    field.setAttribute(inlineEditAttribute, "");
    const wrapper = document.createElement("div");
    wrapper.setAttribute(inlineEditAttribute, "");
    const inner = document.createElement("span");
    wrapper.append(inner);

    expect(isInlineEditTarget(field)).toBe(true);
    expect(isInlineEditTarget(inner)).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isInlineEditTarget(null)).toBe(false);
    expect(isInlineEditTarget(window)).toBe(false);
    expect(isInlineEditTarget(document.createTextNode("x"))).toBe(false);
    expect(isInlineEditTarget(document.createElement("input"))).toBe(false);
  });
});
