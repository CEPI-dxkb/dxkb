import {
  canMaximize,
  dialogGutter,
  effectiveDialogSize,
  expandedDialogSize,
  isMaximized,
  maxStoredColumns,
  maximizeDialogSize,
  parsePickerLayout,
  rememberUntouchedAxes,
  resizedAxes,
  resizeDialogByEdge,
  resizeDialogSize,
  serializePickerLayout,
  type ResizeEdge,
} from "../folder-picker-layout";

const desktop = { width: 1600, height: 900 };
const laptop = { width: 1280, height: 720 };

describe("effectiveDialogSize", () => {
  it("defaults to 1280×672", () => {
    expect(effectiveDialogSize(undefined, desktop)).toEqual({ width: 1280, height: 672 });
  });

  it("never exceeds the viewport minus the gutter", () => {
    expect(effectiveDialogSize(undefined, laptop)).toEqual({
      width: 1280 - dialogGutter,
      height: 672,
    });
    expect(effectiveDialogSize({ width: 1900, height: 1300 }, laptop)).toEqual({
      width: 1280 - dialogGutter,
      height: 720 - dialogGutter,
    });
  });

  it("clamps a stored size to the limits", () => {
    expect(effectiveDialogSize({ width: 100, height: 100 }, desktop)).toEqual({
      width: 720,
      height: 480,
    });
    expect(effectiveDialogSize({ width: 5000, height: 5000 }, { width: 4000, height: 3000 })).toEqual({
      width: 1920,
      height: 1400,
    });
  });
});

describe("resizeDialogSize", () => {
  it("grows by twice the pointer travel because the dialog stays centred", () => {
    expect(resizeDialogSize({ width: 1000, height: 600 }, 50, 20, desktop)).toEqual({
      width: 1100,
      height: 640,
    });
  });

  it("shrinks symmetrically and stops at the minimum", () => {
    expect(resizeDialogSize({ width: 800, height: 600 }, -500, 0, desktop)).toEqual({
      width: 720,
      height: 600,
    });
  });
});

describe("resizeDialogByEdge", () => {
  const start = { width: 1000, height: 600 };
  // The pointer travelled 30px right and 20px down since the press.
  const rightAndDown: readonly (readonly [
    edge: ResizeEdge,
    size: { width: number; height: number },
  ])[] = [
    // East and south follow the travel; west and north take it reversed, so dragging
    // them toward the centre (right, down) shrinks the dialog.
    ["e", { width: 1060, height: 600 }],
    ["s", { width: 1000, height: 640 }],
    ["w", { width: 940, height: 600 }],
    ["n", { width: 1000, height: 560 }],
    ["se", { width: 1060, height: 640 }],
    ["ne", { width: 1060, height: 560 }],
    ["sw", { width: 940, height: 640 }],
    ["nw", { width: 940, height: 560 }],
  ];

  it.each(rightAndDown)(
    "%s moves by twice the signed travel when the pointer goes right and down",
    (edge, expected) => {
      expect(resizeDialogByEdge(edge, start, 30, 20, desktop)).toEqual(expected);
    },
  );

  it.each(rightAndDown)(
    "%s does the opposite when the pointer goes left and up",
    (edge, expected) => {
      // Mirrored around `start`: what grew shrinks by the same amount, and the reverse.
      const mirrored = {
        width: 2 * start.width - expected.width,
        height: 2 * start.height - expected.height,
      };
      expect(resizeDialogByEdge(edge, start, -30, -20, desktop)).toEqual(mirrored);
    },
  );

  it("grows the west edge by twice its outward travel and leaves the height alone", () => {
    expect(resizeDialogByEdge("w", start, -50, 0, desktop)).toEqual({
      width: 1100,
      height: 600,
    });
  });

  it("grows the north edge by twice its outward travel and leaves the width alone", () => {
    expect(resizeDialogByEdge("n", start, 0, -50, desktop)).toEqual({
      width: 1000,
      height: 700,
    });
  });

  it("grows the north-west corner on both axes", () => {
    expect(resizeDialogByEdge("nw", start, -50, -30, desktop)).toEqual({
      width: 1100,
      height: 660,
    });
  });

  it.each(["w", "e"] as const)(
    "ignores the vertical travel of the %s edge",
    (edge) => {
      expect(resizeDialogByEdge(edge, start, 10, 400, desktop).height).toBe(
        start.height,
      );
      expect(resizeDialogByEdge(edge, start, 10, -400, desktop).height).toBe(
        start.height,
      );
    },
  );

  it.each(["n", "s"] as const)(
    "ignores the horizontal travel of the %s edge",
    (edge) => {
      expect(resizeDialogByEdge(edge, start, 400, 10, desktop).width).toBe(
        start.width,
      );
      expect(resizeDialogByEdge(edge, start, -400, 10, desktop).width).toBe(
        start.width,
      );
    },
  );

  it("is resizeDialogSize for the south-east corner, which the pointer drags the way it moves", () => {
    expect(resizeDialogByEdge("se", start, 37, -12, desktop)).toEqual(
      resizeDialogSize(start, 37, -12, desktop),
    );
  });

  it("stops at the minimum size however far a side is dragged inward", () => {
    expect(resizeDialogByEdge("w", start, 5000, 0, desktop)).toEqual({
      width: 720,
      height: 600,
    });
    expect(resizeDialogByEdge("n", start, 0, 5000, desktop)).toEqual({
      width: 1000,
      height: 480,
    });
    expect(resizeDialogByEdge("se", start, -5000, -5000, desktop)).toEqual({
      width: 720,
      height: 480,
    });
    expect(resizeDialogByEdge("nw", start, 5000, 5000, desktop)).toEqual({
      width: 720,
      height: 480,
    });
  });

  it("stops at the window less the gutter however far a side is dragged outward", () => {
    expect(resizeDialogByEdge("w", start, -5000, 0, desktop)).toEqual({
      width: 1568,
      height: 600,
    });
    expect(resizeDialogByEdge("n", start, 0, -5000, desktop)).toEqual({
      width: 1000,
      height: 868,
    });
    expect(resizeDialogByEdge("nw", start, -5000, -5000, desktop)).toEqual({
      width: 1568,
      height: 868,
    });
    expect(resizeDialogByEdge("ne", start, 5000, -5000, desktop)).toEqual({
      width: 1568,
      height: 868,
    });
    expect(resizeDialogByEdge("sw", start, -5000, 5000, desktop)).toEqual({
      width: 1568,
      height: 868,
    });
  });

  it("stops at the size limits on a window bigger than they are", () => {
    const huge = { width: 4000, height: 3000 };
    expect(
      resizeDialogByEdge("nw", { width: 1900, height: 1350 }, -100, -100, huge),
    ).toEqual({ width: 1920, height: 1400 });
    expect(
      resizeDialogByEdge("se", { width: 1900, height: 1350 }, 100, 100, huge),
    ).toEqual({ width: 1920, height: 1400 });
  });

  it("leaves a dialog the window already clamps at that size, so nothing visible changes", () => {
    const small = { width: 1000, height: 700 };
    const clamped = { width: 968, height: 668 };
    expect(resizeDialogByEdge("w", clamped, -50, 0, small)).toEqual(clamped);
    expect(resizeDialogByEdge("n", clamped, 0, -50, small)).toEqual(clamped);
    expect(resizeDialogByEdge("nw", clamped, -50, -50, small)).toEqual(clamped);
    // Which `rememberUntouchedAxes` then reads as untouched, so a wider remembered size
    // is not overwritten by the clamped one.
    expect(
      rememberUntouchedAxes(
        resizeDialogByEdge("w", clamped, -50, 0, small),
        clamped,
        { width: 1500, height: 800 },
      ),
    ).toEqual({ width: 1500, height: 800 });
  });
});

describe("maximizeDialogSize", () => {
  it("fills the viewport minus the gutter", () => {
    expect(maximizeDialogSize(desktop)).toEqual({ width: 1568, height: 868 });
    expect(isMaximized({ width: 1568, height: 868 }, desktop)).toBe(true);
    expect(isMaximized({ width: 1280, height: 672 }, desktop)).toBe(false);
  });

  it("is capped by the limits on a huge screen", () => {
    expect(maximizeDialogSize({ width: 3840, height: 2160 })).toEqual({ width: 1920, height: 1400 });
  });
});

describe("rememberUntouchedAxes", () => {
  const remembered = { width: 1500, height: 800 };
  const current = { width: 968, height: 800 };

  it("keeps the remembered size for an axis that did not change", () => {
    expect(rememberUntouchedAxes(current, current, remembered)).toEqual(remembered);
  });

  it("writes only the axis that changed", () => {
    expect(rememberUntouchedAxes({ width: 968, height: 840 }, current, remembered)).toEqual({
      width: 1500,
      height: 840,
    });
    expect(rememberUntouchedAxes({ width: 928, height: 800 }, current, remembered)).toEqual({
      width: 928,
      height: 800,
    });
  });

  it("writes both axes when both changed", () => {
    expect(rememberUntouchedAxes({ width: 928, height: 840 }, current, remembered)).toEqual({
      width: 928,
      height: 840,
    });
  });

  it("keeps the remembered value for an axis the dragged side never touches, even if the window clamped it", () => {
    // The window narrowed mid-drag: width differs from `current` only through the clamp.
    const next = { width: 928, height: 840 };
    expect(
      rememberUntouchedAxes(next, current, remembered, {
        width: false,
        height: true,
      }),
    ).toEqual({ width: 1500, height: 840 });
    expect(
      rememberUntouchedAxes(next, current, remembered, {
        width: true,
        height: false,
      }),
    ).toEqual({ width: 928, height: 800 });
  });
});

describe("resizedAxes", () => {
  it("moves one axis for a side and two for a corner", () => {
    expect(resizedAxes("n")).toEqual({ width: false, height: true });
    expect(resizedAxes("s")).toEqual({ width: false, height: true });
    expect(resizedAxes("e")).toEqual({ width: true, height: false });
    expect(resizedAxes("w")).toEqual({ width: true, height: false });
    for (const corner of ["nw", "ne", "sw", "se"] as const) {
      expect(resizedAxes(corner)).toEqual({ width: true, height: true });
    }
  });
});

describe("expandedDialogSize", () => {
  it("keeps the default width when only the height can grow", () => {
    // The maximum on 1280 x 720 is 1248 x 688; the 1280 default is wider than that.
    expect(expandedDialogSize(undefined, laptop)).toEqual({ width: 1280, height: 688 });
  });

  it("keeps a remembered width the window cannot show", () => {
    expect(expandedDialogSize({ width: 1500, height: 500 }, { width: 1000, height: 700 })).toEqual({
      width: 1500,
      height: 668,
    });
  });

  it("is the window maximum where that is larger than the remembered or default size", () => {
    expect(expandedDialogSize(undefined, desktop)).toEqual({ width: 1568, height: 868 });
    expect(expandedDialogSize(undefined, desktop)).toEqual(maximizeDialogSize(desktop));
  });

  it("never stores less than a larger remembered size", () => {
    expect(expandedDialogSize({ width: 1700, height: 800 }, desktop)).toEqual({
      width: 1700,
      height: 868,
    });
  });

  it("still renders as the window maximum", () => {
    for (const [stored, viewport] of [
      [undefined, laptop],
      [{ width: 1500, height: 500 }, { width: 1000, height: 700 }],
      [{ width: 1700, height: 800 }, desktop],
    ] as const) {
      const size = effectiveDialogSize(expandedDialogSize(stored, viewport), viewport);
      expect(isMaximized(size, viewport)).toBe(true);
    }
  });
});

describe("canMaximize", () => {
  it("is true when the window leaves room to grow on either axis", () => {
    expect(canMaximize(effectiveDialogSize(undefined, desktop), desktop)).toBe(true);
    // 1248 x 672 against a 1248 x 688 maximum: only the height grows.
    expect(canMaximize(effectiveDialogSize(undefined, laptop), laptop)).toBe(true);
    expect(canMaximize({ width: 800, height: 500 }, { width: 1000, height: 700 })).toBe(true);
  });

  it("is false when the dialog already fills the window", () => {
    const small = { width: 1000, height: 700 };
    expect(effectiveDialogSize(undefined, small)).toEqual({ width: 968, height: 668 });
    expect(canMaximize(effectiveDialogSize(undefined, small), small)).toBe(false);
    expect(canMaximize(maximizeDialogSize(desktop), desktop)).toBe(false);
  });
});

describe("parsePickerLayout / serializePickerLayout", () => {
  it("reads nothing as the default layout", () => {
    expect(parsePickerLayout(null)).toEqual({ columns: {} });
    expect(parsePickerLayout("not json")).toEqual({ columns: {} });
    expect(parsePickerLayout('"a string"')).toEqual({ columns: {} });
  });

  it("round-trips a layout", () => {
    const layout = { dialog: { width: 1400, height: 800 }, columns: { 0: 300, 2: 200 }, preview: 400 };
    expect(parsePickerLayout(serializePickerLayout(layout))).toEqual(layout);
  });

  it("drops a bad field without losing the others", () => {
    expect(
      parsePickerLayout(JSON.stringify({ dialog: { width: "wide" }, preview: 400, columns: { 1: 200 } })),
    ).toEqual({ columns: { 1: 200 }, preview: 400 });
  });

  it("clamps stored widths and ignores out-of-range column indexes", () => {
    expect(
      parsePickerLayout(JSON.stringify({ preview: 9999, columns: { 0: 10, 99: 300, "-1": 300, x: 300 } })),
    ).toEqual({ columns: { 0: 144 }, preview: 560 });
  });

  it("round-trips a column deep in the strip", () => {
    const layout = { columns: { 20: 300 } };
    expect(parsePickerLayout(serializePickerLayout(layout))).toEqual(layout);
  });

  it("drops a column past the cap on write exactly as it does on read", () => {
    const last = maxStoredColumns - 1;
    expect(parsePickerLayout(serializePickerLayout({ columns: { [last]: 300 } }))).toEqual({
      columns: { [last]: 300 },
    });
    expect(serializePickerLayout({ columns: { [maxStoredColumns]: 300 } })).toBeNull();
    expect(
      parsePickerLayout(JSON.stringify({ columns: { [maxStoredColumns]: 300 } })),
    ).toEqual({ columns: {} });
  });

  it("clamps column widths on write exactly as it does on read", () => {
    expect(serializePickerLayout({ columns: { 0: 10, 1: 9999 } })).toBe(
      JSON.stringify({ columns: { 0: 144, 1: 480 } }),
    );
    expect(parsePickerLayout(serializePickerLayout({ columns: { 1: 9999 } }))).toEqual({
      columns: { 1: 480 },
    });
  });

  it("stores nothing when every value is a default", () => {
    expect(serializePickerLayout({ columns: {} })).toBeNull();
    expect(serializePickerLayout({ columns: { 0: 240, 1: 180 }, preview: 320 })).toBeNull();
  });

  it("keeps only the values that differ", () => {
    expect(serializePickerLayout({ columns: { 0: 240, 1: 300 }, preview: 320 })).toBe(
      JSON.stringify({ columns: { 1: 300 } }),
    );
  });
});
