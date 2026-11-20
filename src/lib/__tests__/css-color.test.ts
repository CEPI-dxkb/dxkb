import { resolveCssColor, rgbToHex } from "../css-color";

// jsdom has no 2D canvas. This stand-in behaves like the browser's where it matters: an invalid
// `fillStyle` is ignored (the previous value stays), and the pixel reads back as `pixel`.
function fakeContext(pixel: number[]) {
  let fillStyle = "";
  return {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      if (value !== "not-a-color") fillStyle = value;
    },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(pixel) }),
  } as unknown as CanvasRenderingContext2D;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rgbToHex", () => {
  it("pads each channel to two hex digits", () => {
    expect(rgbToHex(23, 72, 125)).toBe("#17487d");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });
});

describe("resolveCssColor", () => {
  it("resolves a color the browser understands to #rrggbb", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeContext([229, 229, 229, 255]),
    );
    expect(resolveCssColor("oklch(0.922 0 0)")).toBe("#e5e5e5");
  });

  it("is undefined for a value the browser rejects", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeContext([0, 0, 0, 255]),
    );
    expect(resolveCssColor("not-a-color")).toBeUndefined();
  });

  it("is undefined for an empty value", () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    expect(resolveCssColor("")).toBeUndefined();
    expect(getContext).not.toHaveBeenCalled();
  });

  it("is undefined where there is no 2D canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(resolveCssColor("oklch(0.922 0 0)")).toBeUndefined();
  });
});
