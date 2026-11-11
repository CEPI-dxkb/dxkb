import type { FacetBucket } from "@/lib/data-api";

/** "" is a real bucket (records with no value); show it as "(empty)". */
export function displayFacetValue(value: string): string {
  return value === "" ? "(empty)" : value;
}

export interface FacetValueOption {
  value: string;
  count?: number;
}

/**
 * A field's counts leave its own filter out, so picking a value never reorders
 * or shrinks its list.
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

export function describeFilter(label: string, values: readonly string[]): string {
  return `${label}: ${values.map(displayFacetValue).join(", ")}`;
}

export function navigationTarget(
  key: string,
  index: number,
  count: number,
): number | undefined {
  const steps: Partial<Record<string, number>> = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: 8,
    PageUp: -8,
  };
  const step = steps[key];
  if (step === undefined) return undefined;
  return Math.max(0, Math.min(count - 1, index + step));
}
