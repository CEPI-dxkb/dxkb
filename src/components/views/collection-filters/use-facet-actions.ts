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
 * A peek counts a facet outside the pinned set that the user opened; unfiltered
 * peeks drop once every menu closes (`idle`), but an unpinned facet stays
 * counted while a menu is open so its row stays put.
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
