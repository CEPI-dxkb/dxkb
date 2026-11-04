/**
 * A viewer's figure (Compare Region, Circular Viewer) as a standalone SVG
 * file. The figure is drawn with theme classes, which mean nothing outside
 * the page, so a copy is resolved under an off-screen light-theme host first:
 * every class becomes the colors and fonts it computes to there. Exports
 * always use DXKB's light theme, whatever the page's. Every color is then written as sRGB: browsers
 * compute theme tokens and the data colors as `oklch()` / `lab()`, which
 * Illustrator, Office, LibreOffice and many SVG-to-PDF tools cannot read.
 */
import { downloadBlob } from "@/lib/utils";

const svgNamespace = "http://www.w3.org/2000/svg";
const xmlnsNamespace = "http://www.w3.org/2000/xmlns/";

/** A color as 8-bit sRGB channels, with its alpha (0–1) apart. */
export interface SrgbColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

/** Any CSS color as sRGB; null when it is no color (or cannot be converted here). */
export type ToSrgb = (color: string) => SrgbColor | null;

/**
 * Converts on a 1×1 canvas, which paints any CSS color the browser knows in
 * sRGB (exactly, gamut-mapped when it lies outside), and reads the pixel
 * back. Each distinct color is converted once. Without a 2D context it
 * converts nothing, so the colors are kept as they are.
 */
export function canvasToSrgb(): ToSrgb {
  const cache = new Map<string, SrgbColor | null>();
  let context: CanvasRenderingContext2D | null | undefined;
  return (color) => {
    const cached = cache.get(color);
    if (cached !== undefined) return cached;
    // Looked up once: null (no 2D context) is an answer too.
    if (context === undefined) {
      context = document
        .createElement("canvas")
        .getContext("2d", { willReadFrequently: true });
    }
    let result: SrgbColor | null = null;
    if (context && CSS.supports("color", color)) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      result = { r, g, b, alpha: Math.round((alpha / 255) * 1000) / 1000 };
    }
    cache.set(color, result);
    return result;
  };
}

/** The color attributes, each with the opacity attribute its alpha goes to. */
const colorAttributes = [
  ["fill", "fill-opacity"],
  ["stroke", "stroke-opacity"],
  ["stop-color", "stop-opacity"],
  ["color", null],
] as const;

/** Paints that are no color: kept as they are. */
const notAColor = /^(?:none|currentcolor|inherit|url\(.*)$/i;

function rgbText({ r, g, b }: SrgbColor): string {
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/**
 * Every color attribute (and the root's style color) as `rgb(r, g, b)`, its
 * alpha moved to the matching opacity attribute and multiplied with one
 * already there. A wholly clear fill or stroke becomes `none`.
 *
 * `fill-opacity` / `stroke-opacity` inherit and do not multiply down the
 * tree, so this is exact only while a group whose paint has alpha has no
 * child with a paint of its own, and no alpha-painted child sits under a
 * group's opacity attribute. The figure holds to both (the translucent
 * groups' children set no paint, and the ribbon group's paths are opaque);
 * a layer that breaks either needs its opacity on the painted elements.
 */
function writeSrgbColors(copy: SVGSVGElement, toSrgb: ToSrgb): void {
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const [name, opacityName] of colorAttributes) {
      const value = element.getAttribute(name)?.trim();
      if (!value || notAColor.test(value)) continue;
      const color = toSrgb(value);
      if (!color) continue;
      if (color.alpha === 0 && (name === "fill" || name === "stroke")) {
        element.setAttribute(name, "none");
        continue;
      }
      element.setAttribute(name, rgbText(color));
      if (opacityName && color.alpha < 1) {
        const existing = Number(element.getAttribute(opacityName) ?? "1");
        const opacity = Math.round(color.alpha * existing * 1000) / 1000;
        element.setAttribute(opacityName, String(opacity));
      }
    }
  }
  const rootColor = toSrgb(copy.style.color);
  if (rootColor) copy.style.color = rgbText(rootColor);
}

/** An off-screen element in DXKB's light theme, for resolving the copy's classes. */
function lightThemeHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-theme", "dxkb-light");
  host.setAttribute("aria-hidden", "true");
  host.className = "text-foreground";
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  return host;
}

/**
 * Two kinds of class the copy must not compute with. The `dark:` variant
 * matches anything under a dark-themed <html>, the light host included (it
 * reads the nearest `data-theme` ending in `-dark`, not the closest
 * `data-theme`): without it the copy computes as in the light theme. An
 * animation (`animate-*`, `motion-safe:animate-*`) starts again on the copy,
 * which would export its first frame (the Circular Viewer's rings at opacity
 * 0): without it the copy computes at rest.
 */
function dropLiveOnlyClasses(copy: SVGSVGElement): void {
  for (const element of [copy, ...copy.querySelectorAll("[class]")]) {
    for (const name of [...element.classList]) {
      const utility = name.slice(name.lastIndexOf(":") + 1);
      if (name.startsWith("dark:") || utility.startsWith("animate-")) {
        element.classList.remove(name);
      }
    }
  }
}

/**
 * A mask that only sweeps marks into view (`data-sweep`, the Circular
 * Viewer's rings while their data arrives) is dropped with every `mask`
 * reference to it: at rest it uncovers all the marks, so the file draws them
 * unmasked. Kept, it would lose its class's `mask-type: alpha` and work as a
 * luminance mask, whose dark `currentColor` circle hides what it masks.
 */
function dropSweepMasks(copy: SVGSVGElement): void {
  const references = new Set<string>();
  for (const mask of copy.querySelectorAll("mask[data-sweep]")) {
    references.add(`url(#${mask.id})`);
    mask.remove();
  }
  if (references.size === 0) return;
  for (const element of copy.querySelectorAll("[mask]")) {
    const reference = element.getAttribute("mask")?.trim() ?? "";
    if (references.has(reference)) element.removeAttribute("mask");
  }
}

/** Text set in capitals by CSS (`text-transform: uppercase`) is written in capitals. */
function uppercaseText(copy: SVGSVGElement): void {
  for (const element of copy.querySelectorAll("text, tspan")) {
    if (getComputedStyle(element).textTransform !== "uppercase") continue;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = node.textContent?.toUpperCase() ?? "";
      }
    }
  }
}

/**
 * Every class as the paint it computes to, then no class. Fonts go on every
 * text and tspan (Compact's genome line sets the strain in a tspan), since
 * they also inherit them from a classed group: the size too, which a class
 * such as `text-3xs` sets (the Circular Viewer's position labels), and which
 * a `font-size` attribute computes to unchanged.
 */
function resolveClasses(copy: SVGSVGElement): void {
  for (const element of copy.querySelectorAll("text, tspan")) {
    const style = getComputedStyle(element);
    element.setAttribute("font-family", style.fontFamily);
    element.setAttribute("font-size", style.fontSize);
    element.setAttribute("font-weight", style.fontWeight);
    element.setAttribute("font-style", style.fontStyle);
    element.setAttribute("letter-spacing", style.letterSpacing);
  }
  const classed = [copy, ...copy.querySelectorAll<SVGElement>("[class]")];
  for (const element of classed) {
    if (!element.hasAttribute("class")) continue;
    const style = getComputedStyle(element);
    element.setAttribute("fill", style.fill);
    element.setAttribute("stroke", style.stroke);
    element.setAttribute("opacity", style.opacity);
    if (style.display === "none") element.setAttribute("display", "none");
    element.removeAttribute("class");
  }
}

/**
 * Downloads `svg` (the chart's figure) as `fileName`: the hover overlays
 * (`data-overlay`) and sweep masks (`data-sweep`) dropped, the sticky label
 * column and ruler (`data-sticky`) back in place, every theme class resolved
 * to light-theme colors, and every
 * color written as sRGB through `toSrgb` (tests pass one; jsdom has no canvas).
 */
export function exportSvgFigure(
  svg: SVGSVGElement,
  fileName: string,
  toSrgb: ToSrgb = canvasToSrgb(),
): void {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  // A picture: the genes' buttons and the rows' groups stay in the app.
  copy.setAttribute("role", "img");
  for (const node of copy.querySelectorAll("[role], [tabindex]")) {
    for (const name of ["role", "tabindex", "aria-label"]) {
      node.removeAttribute(name);
    }
  }
  for (const node of copy.querySelectorAll("[data-overlay]")) node.remove();
  for (const node of copy.querySelectorAll("[data-sticky]")) {
    node.removeAttribute("transform");
  }
  dropSweepMasks(copy);
  dropLiveOnlyClasses(copy);
  const host = lightThemeHost();
  host.append(copy);
  document.body.append(host);
  try {
    uppercaseText(copy);
    const root = getComputedStyle(copy);
    copy.style.color = root.color;
    copy.style.fontFamily = root.fontFamily;
    copy.style.backgroundColor = "#fff";
    resolveClasses(copy);
    writeSrgbColors(copy, toSrgb);
    // A namespace declaration, not a plain attribute: the serializer would
    // write a plain `xmlns` beside its own, and the file would not parse.
    copy.setAttributeNS(xmlnsNamespace, "xmlns", svgNamespace);
    const markup = new XMLSerializer().serializeToString(copy);
    downloadBlob(new Blob([markup], { type: "image/svg+xml" }), fileName);
  } finally {
    host.remove();
  }
}
