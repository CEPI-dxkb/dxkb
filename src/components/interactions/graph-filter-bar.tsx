"use client";

import {
  ResourceFilterBar,
  type ResourceFilterBarProps,
} from "@/components/views/resource-filter-bar";
import { noop } from "@/lib/utils";
import { interactionFacets } from "@/lib/views/child-resources";

export type GraphFilterBarProps = Omit<
  ResourceFilterBarProps,
  | "layoutKey"
  | "definitions"
  | "keywordPlaceholder"
  | "columns"
  | "setColumns"
  | "resetColumns"
  | "flushKeywordOnUnmount"
>;

const noColumns: ResourceFilterBarProps["columns"] = [];

/**
 * The Interactions Table's filter bar for the Graph: the same facets, and the
 * Table's layout key so a favorite facet is shared. The Graph has no columns,
 * so the Columns menu (drawn only for a non-empty list) stays hidden. The
 * keyword debounces inside `ResourceFilterBar`, as the Table's does; the Graph
 * unmounts on a switch to the Table tab, so a keyword still in its debounce is
 * committed then rather than lost.
 */
export function GraphFilterBar(props: GraphFilterBarProps) {
  return (
    <ResourceFilterBar
      {...props}
      layoutKey="collection:ppi"
      definitions={interactionFacets}
      keywordPlaceholder="Search interaction results..."
      flushKeywordOnUnmount
      columns={noColumns}
      setColumns={noop}
      resetColumns={noop}
    />
  );
}
