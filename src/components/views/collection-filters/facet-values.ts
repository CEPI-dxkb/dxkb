import type { FacetBucket } from "@/lib/data-api";

/** "" is a real bucket (records with no value); show it as "(empty)". */
export function displayFacetValue(value: string): string {
  return value === "" ? "(empty)" : value;
}

export interface FacetValueOption {
  value: string;
  /** `undefined`: selected, but not in the current counts. */
  count?: number;
}

/**
 * A field's checklist: its counted values, after any selected value the
 * counts no longer list (so it can still be unticked). A field's counts leave
 * its own filter out, so picking a value never reorders or shrinks its list.
 */
export function facetValueOptions(
  buckets: readonly FacetBucket[] | undefined,
  selected: readonly string[],
): FacetValueOption[] {
  const options = (buckets ?? []).map((bucket) => ({
    value: String(bucket.value),
    count: bucket.count,
  }));
  const counted = new Set(options.map((option) => option.value));
  return [
    ...selected.filter((value) => !counted.has(value)).map((value) => ({ value })),
    ...options,
  ];
}

/** "Genome Status: Complete, Partial" — a filter as one line of text. */
export function describeFilter(label: string, values: readonly string[]): string {
  return `${label}: ${values.map(displayFacetValue).join(", ")}`;
}
