import type { CollectionState } from "./collection-state";

/**
 * `ResourceCollection` uses `buildStructuralRql` instead of `basePredicate`
 * whenever it returns a clause, so each branch must `and` the parent rql back
 * in or a facet click widens the tab. The Interactions Graph calls this too, so
 * both views send byte-equal predicates for the same filters.
 */
export function scopedStructuralRql(
  rql: string,
  buildStructuralRql?: (state: CollectionState) => string | undefined,
) {
  return (state: CollectionState) => {
    const structuralRql = buildStructuralRql?.(state);
    return structuralRql ? `and(${rql},${structuralRql})` : rql;
  };
}
