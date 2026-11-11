/** Tests pass `estimateTextWidth`, which needs no canvas (jsdom has none). */

function fontSize(font: string): number {
  return Number.parseFloat(
    font.split(" ").find((part) => part.endsWith("px")) ?? "12",
  );
}

export function estimateTextWidth(text: string, font: string): number {
  return text.length * fontSize(font) * 0.56;
}

// Set on the first measurement, never when the module loads.
let measureContext: CanvasRenderingContext2D | null | undefined;
let pageFont: string | undefined;
const widthCache = new Map<string, number>();
const widthCacheLimit = 5000;

function fontFamily(): string {
  pageFont ??=
    typeof document === "undefined"
      ? "sans-serif"
      : getComputedStyle(document.body).fontFamily || "sans-serif";
  return pageFont;
}

export function canvasTextWidth(text: string, font: string): number {
  const key = `${font}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (measureContext === undefined) {
    measureContext =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  }
  let width = estimateTextWidth(text, font);
  if (measureContext) {
    measureContext.font = `${font} ${fontFamily()}`;
    width = measureContext.measureText(text).width;
  }
  if (widthCache.size >= widthCacheLimit) widthCache.clear();
  widthCache.set(key, width);
  return width;
}
