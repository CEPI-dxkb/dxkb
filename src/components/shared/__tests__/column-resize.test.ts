import {
  columnScale,
  columnWidthSettings,
  resizedColumnWidths,
  stretchedColumnWidths,
  type ColumnResizeStart,
} from "../column-resize";

/** Three columns with settings 100/50/50 in a box `containerWidth` wide. */
function start(
  index: number,
  containerWidth: number,
  sizes = [100, 50, 50],
): ColumnResizeStart {
  return {
    columnIds: ["name", "size", "owner"],
    sizes,
    minSizes: [40, 40, 40],
    maxSizes: [1000, 1000, 1000],
    index,
    containerWidth,
  };
}

/** Right edge of column `index` (px from the table's left edge). */
function edge(widths: number[], index: number): number {
  return widths.slice(0, index + 1).reduce((a, b) => a + b, 0);
}

describe("columnScale", () => {
  it("scales settings up to fill a wider box", () => {
    expect(columnScale([100, 50, 50], 400)).toBe(2);
  });

  it("leaves settings that overflow the box alone", () => {
    expect(columnScale([100, 50, 50], 150)).toBe(1);
  });

  it("is 1 for an unmeasured box", () => {
    expect(columnScale([100, 50, 50], 0)).toBe(1);
  });
});

describe("resizedColumnWidths in a table stretched to fill its box", () => {
  it("moves the dragged edge by exactly the pointer delta", () => {
    for (const delta of [-20, 1, 15, 60]) {
      const widths = resizedColumnWidths(start(1, 400), delta);
      // At rest the edge is at (100 + 50) * 2 = 300.
      expect(edge(widths, 1)).toBeCloseTo(300 + delta);
    }
  });

  it("keeps the columns before the dragged one where they were", () => {
    const widths = resizedColumnWidths(start(1, 400), 40);
    expect(widths[0]).toBe(200);
  });

  it("keeps the table filling its box", () => {
    const widths = resizedColumnWidths(start(0, 400), -50);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(400);
  });

  it("grows past the box once the following columns reach their minimum", () => {
    // Owner can give up 100 - 80 = 20px before hitting 40 * 2.
    const widths = resizedColumnWidths(start(1, 400), 50);
    expect(widths[2]).toBe(80);
    expect(edge(widths, 1)).toBe(350);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(430);
  });

  it("stops the dragged column at its scaled minimum", () => {
    const widths = resizedColumnWidths(start(1, 400), -500);
    expect(widths[1]).toBe(80);
  });

  it("does not shrink the last column away from the box's edge", () => {
    const widths = resizedColumnWidths(start(2, 400), -60);
    expect(widths).toStrictEqual([200, 100, 100]);
  });

  it("lets the last column widen past the box", () => {
    const widths = resizedColumnWidths(start(2, 400), 60);
    expect(widths).toStrictEqual([200, 100, 160]);
  });
});

describe("resizedColumnWidths in an overflowing table", () => {
  it("moves only the dragged column", () => {
    const widths = resizedColumnWidths(start(0, 150), 30);
    expect(widths).toStrictEqual([130, 50, 50]);
  });

  it("widens the following columns only to fill the box", () => {
    // 200px of settings in a 150px box; shrinking name by 80 leaves 30px empty.
    const widths = resizedColumnWidths(start(0, 150), -80);
    expect(widths[0]).toBe(40);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(150);
  });

  it("behaves as a plain px resize in an unmeasured box", () => {
    expect(resizedColumnWidths(start(1, 0), 25)).toStrictEqual([100, 75, 50]);
  });
});

describe("columnWidthSettings", () => {
  it("returns nothing for a drag that went nowhere", () => {
    const s = start(1, 400);
    expect(columnWidthSettings(s, resizedColumnWidths(s, 0))).toStrictEqual(
      {},
    );
  });

  it("keeps the settings' total while the table fills its box", () => {
    const s = start(1, 400);
    const settings = columnWidthSettings(s, resizedColumnWidths(s, 20));
    // Size renders 100 + 20 = 120 at scale 2; owner gives up the 20.
    expect(settings).toStrictEqual({ size: 60, owner: 40 });
  });

  it("stores rendered px once the table overflows its box", () => {
    const s = start(1, 400);
    const settings = columnWidthSettings(s, resizedColumnWidths(s, 50));
    expect(settings).toStrictEqual({ name: 200, size: 150, owner: 80 });
  });

  it("renders the same layout once saved", () => {
    const s = start(1, 400);
    const widths = resizedColumnWidths(s, 20);
    const settings = columnWidthSettings(s, widths);
    const saved = s.columnIds.map((id, i) => settings[id] ?? s.sizes[i]);
    const scale = columnScale(saved, 400);
    saved.forEach((setting, i) => {
      expect(setting * scale).toBeCloseTo(widths[i]);
    });
  });

  it("clamps a setting to the column's limits", () => {
    const s = start(0, 0);
    expect(columnWidthSettings(s, resizedColumnWidths(s, 3200))).toStrictEqual(
      { name: 1000 },
    );
  });
});

// The DataTable's selection column is not resizable: it neither stretches nor
// absorbs a drag, and gets no saved setting.
describe("a fixed column", () => {
  function withSelection(index: number): ColumnResizeStart {
    return {
      columnIds: ["select", "name", "size"],
      sizes: [40, 100, 50],
      minSizes: [40, 40, 40],
      maxSizes: [1000, 1000, 1000],
      fixed: [true, false, false],
      index,
      containerWidth: 340,
    };
  }

  it("keeps its width when the others stretch", () => {
    // 300px of room for 150px of resizable settings.
    expect(stretchedColumnWidths([40, 100, 50], 340, [true, false, false]))
      .toStrictEqual([40, 200, 100]);
  });

  it("stays put while a later column is dragged", () => {
    const widths = resizedColumnWidths(withSelection(1), 10);
    expect(widths[0]).toBe(40);
    expect(edge(widths, 1)).toBe(250);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(340);
  });

  it("does not resize when it is the dragged column", () => {
    expect(resizedColumnWidths(withSelection(0), 30)).toStrictEqual([
      40, 200, 100,
    ]);
  });

  it("gets no saved setting", () => {
    const s = withSelection(1);
    const settings = columnWidthSettings(s, resizedColumnWidths(s, 10));
    // 210 and 90 rendered at scale 2.
    expect(settings).toStrictEqual({ name: 105, size: 45 });
  });
});
