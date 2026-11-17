import type { OrganismGenusFacet } from "./types";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

interface BucketGroup {
  name: string;
  largestCount: number;
  total: number;
}

/**
 * Merges buckets whose names differ only in letter case or whitespace.
 *
 * The Data API matches these fields case-insensitively (`string_ci`), so one
 * `eq` on the winning spelling already lists every variant. The group takes
 * the spelling with the largest count (the first one returned on a tie), the
 * counts add up, and the result is re-sorted by merged count; Array#sort is
 * stable, so equal counts keep the order Solr returned. Different words
 * ("Nasal" and "Nasal swab") are deliberately not merged.
 */
export function foldFacetBuckets(
  buckets: OrganismGenusFacet[],
): OrganismGenusFacet[] {
  const groups = new Map<string, BucketGroup>();
  for (const bucket of buckets) {
    const name = collapseWhitespace(bucket.name);
    const key = name.toLowerCase();
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        name,
        largestCount: bucket.count,
        total: bucket.count,
      });
      continue;
    }
    group.total += bucket.count;
    if (bucket.count > group.largestCount) {
      group.name = name;
      group.largestCount = bucket.count;
    }
  }
  return [...groups.values()]
    .map((group) => ({ name: group.name, count: group.total }))
    .sort((a, b) => b.count - a.count);
}
