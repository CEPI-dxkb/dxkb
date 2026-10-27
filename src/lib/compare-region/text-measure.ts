/**
 * Text widths for the Compare Region Viewer's labels, which must fit whole
 * (gene labels) or be cut to fit (genome names). The label functions take a
 * measure as an argument (`TextMeasure` in `labels.ts`): the chart passes
 * `canvasTextWidth`, which measures in the page's font, and tests pass
 * `estimateTextWidth`, which needs no canvas (jsdom has none).
 */

/** The px size in a CSS font shorthand ("italic 500 10px"); 12 when it names none. */
function fontSize(font: string): number {
  return Number.parseFloat(
    font.split(" ").find((part) => part.endsWith("px")) ?? "12",
  );
}

/**
 * About how wide `text` is in `font` (the CSS shorthand without the family):
 * 0.56 of the font size a character.
 */
export function estimateTextWidth(text: string, font: string): number {
  return text.length * fontSize(font) * 0.56;
}

// Set on the first measurement, never when the module loads.
let measureContext: CanvasRenderingContext2D | null | undefined;
let pageFont: string | undefined;
const widthCache = new Map<string, number>();
/** Past this many font and text pairs the cache starts over, so a long visit cannot grow it without bound. */
const widthCacheLimit = 5000;

function fontFamily(): string {
  pageFont ??=
    typeof document === "undefined"
      ? "sans-serif"
      : getComputedStyle(document.body).fontFamily || "sans-serif";
  return pageFont;
}

/**
 * How wide `text` is in `font` (the CSS shorthand without the family) in the
 * page's font family, measured on a canvas and cached per font and text.
 * Without a 2D context (no DOM) it is `estimateTextWidth`.
 */
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
