import {
  columnScale,
  columnWidthSettings,
  distributeWidths,
  resizeColumns,
  resizedColumnWidths,
  stretchedColumnWidths,
  type ColumnResizeStart,
} from "../column-resize";

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
    expect(settings).toStrictEqual({ name: 105, size: 45 });
  });
});

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function workspace(
  index: number,
  containerWidth: number,
  maxSizes = [1000, 1000, 1000, 1000, 1000, 1000],
  sizes = [220, 50, 70, 80, 55, 60],
): ColumnResizeStart {
  return {
    columnIds: ["name", "size", "owner", "created", "members", "type"],
    sizes,
    minSizes: [40, 40, 40, 40, 40, 40],
    maxSizes,
    index,
    containerWidth,
  };
}

describe("distributeWidths", () => {
  it("shares the total in proportion when no bound is hit", () => {
    expect(distributeWidths([100, 50], [0, 0], [1000, 1000], 300)).toEqual([
      200, 100,
    ]);
  });

  it("pins columns at their minimum and shares what is left among the rest", () => {
    const lo = [80, 80, 80, 80, 80];
    const hi = [2000, 2000, 2000, 2000, 2000];
    const out = distributeWidths([100, 140, 160, 110, 120], lo, hi, 430);
    expect(sum(out)).toBeCloseTo(430);
    expect(out[0]).toBe(80);
    expect(out[3]).toBe(80);
    expect(out[4]).toBe(80);
    expect(out[1] / out[2]).toBeCloseTo(140 / 160);
  });

  it("pins a column at its maximum", () => {
    expect(distributeWidths([100, 100], [0, 0], [120, 1000], 400)).toEqual([
      120, 280,
    ]);
  });

  it("gives every column its bound when the total is out of reach", () => {
    expect(distributeWidths([100, 100], [80, 80], [120, 120], 100)).toEqual([
      80, 80,
    ]);
    expect(distributeWidths([100, 100], [80, 80], [120, 120], 900)).toEqual([
      120, 120,
    ]);
  });
});

describe("distributeWidths with violations on both sides", () => {
  it("pins the low and the high column in one call", () => {
    const out = distributeWidths(
      [10, 100, 400],
      [50, 50, 50],
      [1000, 1000, 150],
      600,
    );
    expect(out[0]).toBe(50);
    expect(out[2]).toBe(150);
    expect(sum(out)).toBeCloseTo(600);
  });
});

describe("resizeColumns", () => {
  it.each([
    [0, 1070],
    [2, 1070],
    [5, 1070],
    [0, 1605],
    [3, 400],
    [0, 400],
  ])("previews exactly what it saves (column %i, %ipx box)", (index, box) => {
    const s = workspace(index, box);
    for (const delta of [-300, -40, -3, -1, 0, 1, 2, 3, 37, 200, 700]) {
      const { widths, settings } = resizeColumns(s, delta);
      const saved = s.columnIds.map((id, i) => settings[id] ?? s.sizes[i]);
      expect(widths).toEqual(stretchedColumnWidths(saved, box));
      for (const setting of saved) {
        expect(Number.isInteger(setting)).toBe(true);
        expect(setting).toBeGreaterThanOrEqual(40);
        expect(setting).toBeLessThanOrEqual(1000);
      }
    }
  });

  it("stops a widened column at what it can save, so release does not snap", () => {
    const { widths, settings } = resizeColumns(workspace(0, 1070), 700);
    expect(widths[0]).toBe(1000);
    expect(settings.name).toBe(1000);
  });

  it("keeps a filling table filling while the following columns have room", () => {
    const { widths } = resizeColumns(workspace(0, 1070), 200);
    expect(sum(widths)).toBeCloseTo(1070);
    expect(widths[0]).toBeCloseTo(640);
    for (const width of widths.slice(1)) expect(width).toBeGreaterThanOrEqual(80);
  });

  it("never stretches a following column past its maximum", () => {
    const s = workspace(0, 1070, [1000, 60, 1000, 1000, 1000, 1000]);
    const { widths, settings } = resizeColumns(s, -300);
    expect(widths[1]).toBeLessThanOrEqual(120 + 1e-9);
    const saved: Partial<Record<string, number>> = settings;
    expect(saved.size ?? 50).toBeLessThanOrEqual(60);
    expect(sum(widths)).toBeCloseTo(1070);
  });

  it("keeps the last column at the box edge when an overflowing table shrinks", () => {
    const s = workspace(5, 1070, undefined, [600, 100, 100, 100, 100, 200]);
    const { widths } = resizeColumns(s, -150);
    expect(widths[5]).toBe(70);
    expect(sum(widths)).toBe(1070);
  });

  it("neither moves nor saves a drag smaller than one setting step", () => {
    const s = workspace(0, 1605);
    const { widths, settings } = resizeColumns(s, 1);
    expect(settings).toEqual({});
    expect(widths).toEqual(stretchedColumnWidths(s.sizes, 1605));
  });

  it("keeps the settings total while the table fills", () => {
    const s = workspace(0, 1070);
    const { settings } = resizeColumns(s, 37);
    const saved = s.columnIds.map((id, i) => settings[id] ?? s.sizes[i]);
    expect(sum(saved)).toBe(535);
  });

  it("moves the edge steadily across the switch to overflow", () => {
    const s = workspace(0, 1070);
    let last = 440;
    for (let delta = 0; delta <= 800; delta += 1) {
      const [name] = resizeColumns(s, delta).widths;
      expect(name).toBeGreaterThanOrEqual(last);
      expect(name - last).toBeLessThanOrEqual(2 + 1e-9);
      last = name;
    }
    expect(last).toBe(1000);
  });

  it("never moves a column before the dragged one when it is past its maximum", () => {
    const s: ColumnResizeStart = {
      columnIds: ["a", "b", "c"],
      sizes: [400, 100, 100],
      minSizes: [40, 40, 40],
      maxSizes: [1000, 1000, 1000],
      index: 1,
      containerWidth: 1800,
    };
    let lastEdge = 0;
    for (let delta = 0; delta <= 900; delta += 1) {
      const { widths } = resizeColumns(s, delta);
      expect(widths[0]).toBe(1200);
      const edgePx = widths[0] + widths[1];
      expect(edgePx).toBeGreaterThanOrEqual(lastEdge);
      lastEdge = edgePx;
    }
  });

  it.each([1605, 2000])(
    "keeps the edge within half a setting step of the raw target (%ipx box)",
    (box) => {
      const s = workspace(0, box);
      const k = columnScale(s.sizes, box);
      const raw0 = stretchedColumnWidths(s.sizes, box)[0];
      for (let delta = -100; delta <= 300; delta += 0.37) {
        const target = resizedColumnWidths(s, delta)[0];
        if (target <= 40 * k + 1e-9 || target >= 1000 - 1e-9) continue;
        expect(target).toBeCloseTo(raw0 + delta);
        const { widths } = resizeColumns(s, delta);
        expect(Math.abs(widths[0] - target)).toBeLessThanOrEqual(k / 2 + 1e-9);
      }
    },
  );

  it("keeps a fixed selection column at its width and saves no setting for it", () => {
    const s: ColumnResizeStart = {
      columnIds: ["select", "name", "size"],
      sizes: [40, 100, 50],
      minSizes: [40, 40, 40],
      maxSizes: [1000, 1000, 1000],
      fixed: [true, false, false],
      index: 1,
      containerWidth: 340,
    };
    const { widths, settings } = resizeColumns(s, 11);
    expect(widths[0]).toBe(40);
    expect(settings).not.toHaveProperty("select");
  });

  it("clamps to the limits and saves integers in an unmeasured box", () => {
    const s = workspace(0, 0);
    for (const delta of [-500, -3.4, 2.6, 5000]) {
      const { settings } = resizeColumns(s, delta);
      for (const setting of Object.values(settings)) {
        expect(Number.isInteger(setting)).toBe(true);
        expect(setting).toBeGreaterThanOrEqual(40);
        expect(setting).toBeLessThanOrEqual(1000);
      }
    }
    expect(resizeColumns(s, 5000).settings.name).toBe(1000);
    expect(resizeColumns(s, -500).settings.name).toBe(40);
  });
});

describe("resizedColumnWidths with tight bounds on the columns after the edge", () => {
  it("never moves the columns before the edge or the edge backwards", () => {
    const tight: ColumnResizeStart = {
      columnIds: ["a", "b", "c", "d"],
      sizes: [135, 34, 194, 73],
      minSizes: [52, 21, 74, 70],
      maxSizes: [322, 580, 346, 82],
      index: 1,
      containerWidth: 814,
    };
    const startWidths = stretchedColumnWidths(
      tight.sizes,
      tight.containerWidth,
    );
    let previousEdge = -Infinity;
    for (let delta = 0; delta <= 400; delta += 0.25) {
      const { widths } = resizeColumns(tight, delta);
      expect(Math.abs(widths[0] - startWidths[0])).toBeLessThanOrEqual(1);
      const current = edge(widths, 1);
      expect(current).toBeGreaterThanOrEqual(previousEdge - 1e-9);
      previousEdge = current;
    }
  });
});
