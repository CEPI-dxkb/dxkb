import { render } from "@testing-library/react";
import { createRef, type RefObject } from "react";

import { AnchoredSuggestionPortal } from "@/components/services/anchored-suggestion-portal";

// Mirrors the constants inside the component under test.
const gap = 4;
const preferredHeight = 256;

interface AnchorBox {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

function makeAnchor(box: AnchorBox) {
  const element = document.createElement("div");
  let current = box;
  element.getBoundingClientRect = () => ({
    top: current.top,
    bottom: current.bottom,
    left: current.left,
    right: current.left + current.width,
    width: current.width,
    height: current.bottom - current.top,
    x: current.left,
    y: current.top,
    toJSON: () => ({}),
  });
  document.body.appendChild(element);
  return {
    element,
    moveTo(next: AnchorBox) {
      current = next;
    },
  };
}

function readRect(ref: RefObject<HTMLDivElement | null>) {
  const style = ref.current?.style;
  return {
    top: Number.parseFloat(style?.top ?? ""),
    left: Number.parseFloat(style?.left ?? ""),
    width: Number.parseFloat(style?.width ?? ""),
    maxHeight: Number.parseFloat(style?.maxHeight ?? ""),
  };
}

const originalInnerHeight = window.innerHeight;

function setViewportHeight(height: number) {
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  setViewportHeight(originalInnerHeight);
});

describe("AnchoredSuggestionPortal", () => {
  it("renders below the anchor at the preferred height when space allows", () => {
    setViewportHeight(1000);
    const anchor = makeAnchor({ top: 60, bottom: 100, left: 20, width: 300 });
    const dropdownRef = createRef<HTMLDivElement>();

    render(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );

    expect(readRect(dropdownRef)).toEqual({
      top: 100 + gap,
      left: 20,
      width: 300,
      maxHeight: preferredHeight,
    });
  });

  it("keeps the bottom edge inside the viewport when space below is just over the preferred height", () => {
    // spaceBelow === 256: the gap used to be added to `top` without being
    // deducted from `maxHeight`, overflowing the viewport by `gap`.
    setViewportHeight(800);
    const anchor = makeAnchor({ top: 504, bottom: 544, left: 0, width: 200 });
    const dropdownRef = createRef<HTMLDivElement>();

    render(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );

    const rect = readRect(dropdownRef);
    expect(rect.top).toBe(544 + gap);
    expect(rect.maxHeight).toBe(252);
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(800);
  });

  it("keeps the bottom edge inside the viewport when space below is just over the minimum height", () => {
    // spaceBelow === 160: the old `Math.max(spaceBelow - gap, minHeight)`
    // re-inflated the height and cancelled the gap subtraction.
    setViewportHeight(800);
    const anchor = makeAnchor({ top: 600, bottom: 640, left: 0, width: 200 });
    const dropdownRef = createRef<HTMLDivElement>();

    render(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );

    const rect = readRect(dropdownRef);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(800);
  });

  it("never positions the flipped-up dropdown above the top of the viewport", () => {
    // Not enough room below, and less than minHeight above: the old
    // `Math.max(anchorRect.top - gap, minHeight)` produced top === -64.
    setViewportHeight(200);
    const anchor = makeAnchor({ top: 100, bottom: 140, left: 0, width: 200 });
    const dropdownRef = createRef<HTMLDivElement>();

    render(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );

    const rect = readRect(dropdownRef);
    expect(rect.top).toBe(0);
    expect(rect.maxHeight).toBe(96);
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(100);
  });

  it("re-measures the anchor when reopened after it has moved", () => {
    // `rect` is deliberately retained while closed, so the reopen path has to
    // measure again. Note jsdom cannot observe the paint timing that motivates
    // the layout effect — this asserts the resulting coordinates only.
    setViewportHeight(1000);
    const anchor = makeAnchor({ top: 60, bottom: 100, left: 20, width: 300 });
    const dropdownRef = createRef<HTMLDivElement>();

    const { rerender } = render(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );
    expect(readRect(dropdownRef).top).toBe(104);

    rerender(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open={false}
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );
    expect(dropdownRef.current).toBeNull();

    anchor.moveTo({ top: 360, bottom: 400, left: 20, width: 300 });

    rerender(
      <AnchoredSuggestionPortal
        anchorRef={{ current: anchor.element }}
        dropdownRef={dropdownRef}
        open
      >
        <span>suggestion</span>
      </AnchoredSuggestionPortal>,
    );

    expect(readRect(dropdownRef).top).toBe(404);
  });
});
