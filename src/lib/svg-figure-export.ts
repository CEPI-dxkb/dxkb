/** Exports a viewer figure as standalone SVG with theme classes resolved under a light theme and colors written as sRGB (many SVG tools cannot read `oklch()`). */
import { downloadBlob } from "@/lib/utils";

const svgNamespace = "http://www.w3.org/2000/svg";
const xmlnsNamespace = "http://www.w3.org/2000/xmlns/";

export interface SrgbColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export type ToSrgb = (color: string) => SrgbColor | null;

/** Converts via a 1×1 canvas (sRGB, gamut-mapped), caching each color; without a 2D context colors are kept as-is. */
export function canvasToSrgb(): ToSrgb {
  const cache = new Map<string, SrgbColor | null>();
  let context: CanvasRenderingContext2D | null | undefined;
  return (color) => {
    const cached = cache.get(color);
    if (cached !== undefined) return cached;
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

const colorAttributes = [
  ["fill", "fill-opacity"],
  ["stroke", "stroke-opacity"],
  ["stop-color", "stop-opacity"],
  ["color", null],
] as const;

const notAColor = /^(?:none|currentcolor|inherit|url\(.*)$/i;

function rgbText({ r, g, b }: SrgbColor): string {
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/** `fill-opacity`/`stroke-opacity` do not multiply down the tree, so this is exact only while no alpha-painted group has children with their own paint. */
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

/** Classes the copy must not compute with: `dark:` matches under a dark `<html>` even on the light host, and animations would export their first frame. */
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

/** A sweep-only mask (`data-sweep`) is dropped with its references; kept, it would act as a luminance mask and hide what it masks. */
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

/** Fonts and sizes go on every text and tspan, since they may be inherited from a classed group. */
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

/** Downloads `svg` as `fileName`; `toSrgb` is injectable because jsdom has no canvas. */
export function exportSvgFigure(
  svg: SVGSVGElement,
  fileName: string,
  toSrgb: ToSrgb = canvasToSrgb(),
): void {
  const copy = svg.cloneNode(true) as SVGSVGElement;
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
    // A namespace declaration, not a plain attribute: a plain `xmlns` would duplicate the serializer's and break parsing.
    copy.setAttributeNS(xmlnsNamespace, "xmlns", svgNamespace);
    const markup = new XMLSerializer().serializeToString(copy);
    downloadBlob(new Blob([markup], { type: "image/svg+xml" }), fileName);
  } finally {
    host.remove();
  }
}
