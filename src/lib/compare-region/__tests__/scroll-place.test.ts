import { focusRow, mirroredRow } from "@/test-helpers/compare-region";
import { densitySpecs } from "../density";
import { measureFigure } from "../figure-frame";
import { layoutCompareRegion } from "../layout";
import { scrollPlace, scrollTopFor } from "../scroll-place";

const layout = layoutCompareRegion([focusRow, mirroredRow]);
// Comfortable slots: row 0 30–84 (center 54), row 1 84–130 (center 106).
const comfortable = measureFigure(layout, densitySpecs.comfortable);
// Compact slots: row 0 30–64 (center 45), row 1 64–94 (center 79).
const compact = measureFigure(layout, densitySpecs.compact);

function at(scrollTop: number, scrollLeft = 0) {
  return { scrollTop, scrollLeft };
}

describe("scrollPlace and scrollTopFor, unpinned", () => {
  it("starts at the top without a scroller, or unscrolled", () => {
    const start = { rowIndex: 0, pinned: false, offset: 0, left: 0 };
    expect(scrollPlace(null, comfortable, null)).toEqual(start);
    expect(scrollPlace(at(0), comfortable, null)).toEqual(start);
    expect(scrollTopFor(start, compact, 200)).toBe(0);
  });

  it("keeps the top row at the same depth under the ruler", () => {
    const place = scrollPlace(at(40, 12), comfortable, null);
    expect(place).toEqual(
      expect.objectContaining({ rowIndex: 0, pinned: false, left: 12 }),
    );
    expect(place.offset).toBeCloseTo(0.7407, 4);
    expect(scrollTopFor(place, compact, 200)).toBeCloseTo(25.19, 2);
  });

  it("finds the row whose slot is under the ruler's bottom edge", () => {
    const place = scrollPlace(at(80), comfortable, null);
    expect(place.rowIndex).toBe(1);
    expect(place.offset).toBeCloseTo(0.5652, 4);
    expect(scrollTopFor(place, compact, 200)).toBeCloseTo(50.96, 2);
  });

  it("falls back to row 0 when the view's top is past every slot", () => {
    expect(scrollPlace(at(500), comfortable, null)).toEqual(
      expect.objectContaining({ rowIndex: 0, pinned: false }),
    );
  });

  it("falls back to unpinned when the pinned row is not in the frame", () => {
    expect(scrollPlace(at(40), comfortable, 5)).toEqual(
      expect.objectContaining({ rowIndex: 0, pinned: false }),
    );
  });
});

describe("scrollPlace and scrollTopFor, pinned", () => {
  it("keeps the pinned row at the same height on screen", () => {
    const place = scrollPlace(at(40), comfortable, 1);
    expect(place).toEqual({ rowIndex: 1, pinned: true, offset: 66, left: 0 });
    expect(scrollTopFor(place, compact, 200)).toBe(13);
  });

  it("puts the slot's top under the ruler when the whole slot cannot fit", () => {
    expect(scrollTopFor(scrollPlace(at(40), comfortable, 1), compact, 20)).toBe(
      34,
    );
  });

  it("never scrolls above the top", () => {
    // Unclamped, these are -9 and -27.
    expect(scrollTopFor(scrollPlace(at(0), comfortable, 0), compact, 200)).toBe(
      0,
    );
    expect(scrollTopFor(scrollPlace(at(0), comfortable, 1), compact, 200)).toBe(
      0,
    );
  });

  it("goes to the top for a row the frame no longer has", () => {
    expect(
      scrollTopFor(
        { rowIndex: 7, pinned: true, offset: 10, left: 0 },
        compact,
        200,
      ),
    ).toBe(0);
  });
});
