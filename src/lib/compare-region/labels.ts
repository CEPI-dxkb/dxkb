import type { DensitySpec } from "./density";
import type { GlyphKind } from "./figure-frame";
import type { PlacedFeature } from "./layout";

export type TextMeasure = (text: string, font: string) => number;

export interface LabelForms {
  forms: string[];
  quiet: boolean;
}

const quietProduct =
  /^(?:hypothetical|putative|uncharacterized|conserved|predicted) protein\b/i;
const enzymeNumber = /\s*\(EC [\d.n-]+\)/g;
const commaList = /^[^,]+(?:, [^,]+?)+ and /;

function dropAsides(text: string): string {
  let result = text;
  let from = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const open = result.indexOf(" (", from);
    if (open === -1) break;
    let depth = 0;
    let close = -1;
    for (let index = open + 1; index < result.length; index += 1) {
      const char = result[index];
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          close = index;
          break;
        }
      }
    }
    if (close === -1) break;
    const after = result.at(close + 1);
    if (after === undefined || after === " " || after === ",") {
      result = `${result.slice(0, open)}${result.slice(close + 1)}`;
    } else {
      from = close + 1;
    }
  }
  return result;
}

const qualifier =
  /\s+(?:of|for|containing|related to|involved in|associated with|similar to|believed to)\s.*$/;
const ribosomal = /\bribosomal protein ([LS]\d+[a-z]*)\b/;
const geneName = /^[A-Z][a-z]{2}[A-Z]\d?$/;
const shortGeneName = /^[A-Z][a-z]{2}$/;

function geneToken(text: string): string | null {
  const rib = ribosomal.exec(text);
  if (rib) return rib[1];
  const words = text.split(/\s+/).map((word) => word.replace(/[,;:]$/, ""));
  let token: string | null = null;
  words.forEach((word, index) => {
    const next = words.at(index + 1);
    if (next === "family" || next === "superfamily" || next === "domain")
      return;
    if (geneName.test(word)) token = word;
    else if (
      shortGeneName.test(word) &&
      (next === undefined || next === "protein")
    ) {
      token = word;
    }
  });
  return token;
}

const formCache = new Map<string, LabelForms>();
const formCacheLimit = 5000;

export function labelForms(product: string): LabelForms {
  const cached = formCache.get(product);
  if (cached) return cached;
  let text = product.split(" @ ")[0].split(" / ")[0].split("; ")[0];
  text = dropAsides(
    text.replace(/^(?:FIG|COG)\d+:\s*/, "").replace(enzymeNumber, ""),
  ).trim();
  const phrase = commaList.test(text) ? text : text.split(", ")[0].trim();
  const token = geneToken(phrase) ?? geneToken(text);
  let result: LabelForms;
  if (!phrase) result = { forms: [], quiet: false };
  else if (quietProduct.test(phrase) && !token) {
    result = { forms: [phrase], quiet: true };
  } else {
    const forms = new Set<string>([phrase]);
    const head = phrase.replace(qualifier, "").trim();
    if (head !== phrase && head.split(/\s+/).length >= 2) forms.add(head);
    if (token) forms.add(token);
    result = {
      forms: [...forms].sort((a, b) => b.length - a.length),
      quiet: false,
    };
  }
  if (formCache.size >= formCacheLimit) formCache.clear();
  formCache.set(product, result);
  return result;
}

export function labelFont(spec: DensitySpec, quiet = false): string {
  const font = `500 ${String(spec.labelSize)}px`;
  return quiet ? `italic ${font}` : font;
}

export interface GlyphLabel {
  text: string;
  x: number;
  y: number;
  quiet: boolean;
}

export function glyphLabel(
  spec: DensitySpec,
  kind: GlyphKind,
  item: PlacedFeature,
  x1: number,
  x2: number,
  box: { top: number; bottom: number },
  plotWidth: number,
  measure: TextMeasure,
): GlyphLabel | null {
  if (kind === "blast" || kind === "other" || !item.feature.product) {
    return null;
  }
  if (box.bottom - box.top < spec.labelMinHeight) return null;
  const forward = x2 >= x1;
  const head = Math.min(spec.headLength, Math.abs(x2 - x1));
  const bodyLeft = forward ? x1 : x2 + head;
  const bodyRight = forward ? x2 - head : x1;
  // A body wholly off the plot (drawn ahead of a drag) is labelled in all of it.
  const onPlot = bodyRight > 0 && bodyLeft < plotWidth;
  const left = (onPlot ? Math.max(bodyLeft, 0) : bodyLeft) + spec.labelPad;
  const right =
    (onPlot ? Math.min(bodyRight, plotWidth) : bodyRight) - spec.labelPad;
  const room = right - left;
  if (room < spec.labelMinRoom) return null;
  const { forms, quiet } = labelForms(item.feature.product);
  const font = labelFont(spec, quiet);
  const text = forms.find((form) => measure(form, font) <= room);
  if (!text) return null;
  return {
    text,
    x: (left + right) / 2,
    y: (box.top + box.bottom) / 2 + spec.labelBaseline,
    quiet,
  };
}

export function fitText(
  text: string,
  maxWidth: number,
  font: string,
  measure: TextMeasure,
): string {
  if (maxWidth <= 0) return "";
  if (measure(text, font) <= maxWidth) return text;
  let low = 0;
  let high = text.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(`${text.slice(0, middle).trimEnd()}…`, font) <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low < 3 ? "" : `${text.slice(0, low).trimEnd()}…`;
}
