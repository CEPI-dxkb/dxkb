import {
  dialogGutter,
  effectiveDialogSize,
  isMaximized,
  maximizeDialogSize,
  parsePickerLayout,
  resizeDialogSize,
  serializePickerLayout,
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
