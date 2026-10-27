"use client";

import { useEffect } from "react";
import type { CollectionToolbarProps } from "./types";

type PeekProps = Pick<
  CollectionToolbarProps,
  | "definitions"
  | "pinnedFields"
  | "setFieldPinned"
  | "peekedFields"
  | "setPeekedFields"
  | "filters"
  | "onFacetsWanted"
>;

/**
 * Peeking and pinning. A peek counts facets outside the pinned set because the
 * user opened them: the active ones when a menu or pill opens, and the whole
 * More group at once when it is unfolded (never one by one on hover). Once
 * every menu has closed (`idle`), an unfiltered peek is dropped again, a
 * filtered one stays until its filter goes. Unpinning a facet keeps it counted
 * (as a peek) while the menu is open, so its row and counts stay put until the
 * menu closes.
 */
export function useFacetActions(props: PeekProps, idle: boolean) {
  const {
    definitions,
    pinnedFields,
    setFieldPinned,
    peekedFields,
    setPeekedFields,
    filters,
    onFacetsWanted,
  } = props;
  useEffect(() => {
    if (!idle || peekedFields.size === 0) return;
    const kept = [...peekedFields].filter(
      (field) => (filters[field]?.length ?? 0) > 0,
    );
    if (kept.length !== peekedFields.size) setPeekedFields(new Set(kept));
  }, [idle, peekedFields, filters, setPeekedFields]);

  const isDefined = (field: string) =>
    definitions.some((definition) => definition.field === field);

  return {
    /** Ask for the counts, and count these fields too if they are not yet. */
    peek: (fields: readonly string[]) => {
      onFacetsWanted();
      const added = fields.filter(
        (field) =>
          isDefined(field) &&
          !pinnedFields.has(field) &&
          !peekedFields.has(field),
      );
      if (added.length === 0) return;
      setPeekedFields(new Set([...peekedFields, ...added]));
    },
    /** Its counts are (or are being) read; a field no facet names has none. */
    isCounted: (field: string) =>
      !isDefined(field) || pinnedFields.has(field) || peekedFields.has(field),
    isPinned: (field: string) => pinnedFields.has(field),
    togglePin: (field: string) => {
      if (!isDefined(field)) return;
      if (pinnedFields.has(field)) {
        setPeekedFields(new Set([...peekedFields, field]));
        setFieldPinned(field, false);
      } else {
        setPeekedFields(
          new Set([...peekedFields].filter((other) => other !== field)),
        );
        setFieldPinned(field, true);
      }
    },
  };
}

export type FacetActions = ReturnType<typeof useFacetActions>;
