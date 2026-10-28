import { estimateTextWidth } from "../text-measure";

describe("estimateTextWidth", () => {
  it("is the length times the font size times 0.56", () => {
    expect(estimateTextWidth("abcd", "500 10px")).toBeCloseTo(22.4, 10);
    expect(estimateTextWidth("abcd", "italic 500 9.5px")).toBeCloseTo(
      21.28,
      10,
    );
    expect(estimateTextWidth("", "500 10px")).toBe(0);
  });

  it("assumes 12 px when the font names no size", () => {
    expect(estimateTextWidth("ab", "500")).toBeCloseTo(13.44, 10);
  });
});

describe("canvasTextWidth", () => {
  // A fresh module each time, so its cached context starts unset.
  const load = async () => {
    vi.resetModules();
    return import("../text-measure");
  };

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.fontFamily = "";
  });

  // Every test stubs `getContext`: jsdom's own prints "Not implemented" (it has no canvas).
  it("falls back to the estimate without a 2D context, and touches no canvas until asked", async () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null);
    const { canvasTextWidth } = await load();
    expect(getContext).not.toHaveBeenCalled();

    expect(canvasTextWidth("abcd", "500 10px")).toBe(
      estimateTextWidth("abcd", "500 10px"),
    );
    expect(canvasTextWidth("Escherichia coli", "italic 500 12px")).toBe(
      estimateTextWidth("Escherichia coli", "italic 500 12px"),
    );
    // The context is looked up once, on the first measurement.
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith("2d");
  });

  it("measures in the page font through a 2D context, once per font and text", async () => {
    const context = {
      font: "",
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    document.body.style.fontFamily = "Geist, sans-serif";
    const { canvasTextWidth } = await load();

    expect(canvasTextWidth("abcd", "500 10px")).toBe(28);
    expect(context.font).toBe("500 10px Geist, sans-serif");
    expect(canvasTextWidth("abcd", "500 10px")).toBe(28);
    expect(context.measureText).toHaveBeenCalledTimes(1);

    expect(canvasTextWidth("abcd", "italic 500 10px")).toBe(28);
    expect(context.font).toBe("italic 500 10px Geist, sans-serif");
    expect(context.measureText).toHaveBeenCalledTimes(2);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("forgets its widths past 5,000 texts, so the cache never grows without bound", async () => {
    const context = {
      font: "",
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const { canvasTextWidth } = await load();
    canvasTextWidth("Escherichia coli", "500 10px");
    for (let index = 0; index < 5000; index += 1) {
      canvasTextWidth(`gene ${String(index)}`, "500 10px");
    }
    context.measureText.mockClear();

    expect(canvasTextWidth("Escherichia coli", "500 10px")).toBe(112);
    expect(context.measureText).toHaveBeenCalledTimes(1);
  });
});
