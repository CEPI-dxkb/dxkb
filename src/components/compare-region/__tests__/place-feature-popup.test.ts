import type { FeatureRef } from "@/lib/compare-region/families";
import { placeFeaturePopupElement } from "../place-feature-popup";

const gene: FeatureRef = { rowIndex: 0, featureIndex: 1 };

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** An element whose box (and scroll box) the placement reads. */
function boxed<T extends HTMLElement | SVGElement>(
  element: T,
  box: Box,
  scrollHeight = box.height,
): T {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
    }) as DOMRect;
  for (const [name, value] of [
    ["clientWidth", box.width],
    ["clientHeight", box.height],
    ["offsetWidth", box.width],
    ["offsetHeight", box.height],
    ["scrollHeight", scrollHeight],
  ] as const) {
    Object.defineProperty(element, name, { configurable: true, value });
  }
  return element;
}

/**
 * A 1,000 × 800 chart whose figure starts 100 px down, right of a 200 px
 * label column, with one glyph (row 0, feature 1) and a 320 × 200 popup.
 */
function chart(glyph: Partial<Box> = {}) {
  const root = boxed(document.createElement("div"), {
    left: 0,
    top: 0,
    width: 1000,
    height: 800,
  });
  const scroller = boxed(document.createElement("div"), {
    left: 0,
    top: 100,
    width: 1000,
    height: 700,
  });
  const path = boxed(
    document.createElementNS("http://www.w3.org/2000/svg", "path"),
    { left: 400, top: 300, width: 100, height: 16, ...glyph },
  );
  path.setAttribute("data-row", "0");
  path.setAttribute("data-feature", "1");
  scroller.append(path);
  const popup = boxed(document.createElement("div"), {
    left: 0,
    top: 0,
    width: 320,
    height: 200,
  });
  popup.setAttribute("data-offscreen", "");
  return { root, scroller, popup };
}

function place(
  { root, scroller, popup }: ReturnType<typeof chart>,
  at: FeatureRef = gene,
) {
  placeFeaturePopupElement({ popup, root, scroller, at, labelWidth: 200 });
  return {
    x: popup.style.getPropertyValue("--popup-x"),
    y: popup.style.getPropertyValue("--popup-y"),
    maxHeight: popup.style.getPropertyValue("--popup-max-h"),
  };
}

describe("placeFeaturePopupElement", () => {
  it("hangs the popup just below and right of its glyph", () => {
    const parts = chart();
    // The glyph spans 400–500 across, 300–316 down; 470 px of room below.
    expect(place(parts)).toEqual({ x: "506px", y: "322px", maxHeight: "470px" });
    expect(parts.popup).not.toHaveAttribute("data-offscreen");
  });

  it("goes left of a glyph near the chart's right edge", () => {
    expect(place(chart({ left: 750 }))).toEqual(
      expect.objectContaining({ x: "424px", y: "322px" }),
    );
  });

  it("goes above a glyph near the chart's bottom", () => {
    // 70 px below, 586 above: its bottom 6 px over the glyph.
    expect(place(chart({ top: 700 }))).toEqual({
      x: "506px",
      y: "494px",
      maxHeight: "586px",
    });
  });

  it("gives a card whose details scroll the roomier side, where neither fits it", () => {
    const parts = chart({ top: 450 });
    // Its details are 600 px tall in a 100 px box: 700 px in all.
    const details = boxed(
      document.createElement("div"),
      { left: 0, top: 0, width: 320, height: 100 },
      600,
    );
    details.setAttribute("data-popup-scroller", "");
    parts.popup.append(details);
    // 320 px below, 336 above, both short of the card's 360.
    expect(place(parts)).toEqual({
      x: "506px",
      y: "244px",
      maxHeight: "336px",
    });
  });

  it("caps the popup's width to the chart's, less its margins", () => {
    const parts = chart();
    place(parts);
    expect(parts.popup.style.getPropertyValue("--popup-max-w")).toBe("984px");
  });

  it("hides the popup while its gene is under the label column", () => {
    const parts = chart({ left: 100, width: 50 });
    parts.popup.removeAttribute("data-offscreen");
    place(parts);
    expect(parts.popup).toHaveAttribute("data-offscreen");
  });

  it("hides the popup while its glyph is not drawn (culled off the plot)", () => {
    const parts = chart();
    parts.popup.removeAttribute("data-offscreen");
    place(parts, { rowIndex: 1, featureIndex: 0 });
    expect(parts.popup).toHaveAttribute("data-offscreen");
  });
});
