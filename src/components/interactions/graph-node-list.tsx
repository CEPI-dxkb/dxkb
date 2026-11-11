"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { colors } from "@/lib/interactions/graph-theme";
import type { GNode } from "@/lib/interactions/types";

interface GraphNodeListProps {
  nodes: GNode[];
  selectedIds: ReadonlySet<string>;
  onSelectNode: (node: GNode) => void;
}

// Sigma wires only pointer events, so this list is the keyboard path to a node (and, via the detail
// panel, its edges).
export function GraphNodeList({
  nodes,
  selectedIds,
  onSelectNode,
}: GraphNodeListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // cmdk's own data-selected cursor follows the pointer and competes with the app selection, so
  // pointer selection is disabled; selection changes scroll the row into view.
  useEffect(() => {
    if (selectedIds.size !== 1) return;
    const el = listRef.current?.querySelector('[data-app-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIds]);

  return (
    <Command
      // value is gene + id so both are searchable by cmdk's filter.
      label="Interaction network nodes"
      className="h-full"
      disablePointerSelection
    >
      <CommandInput placeholder="Search proteins…" />
      <CommandList ref={listRef} className="max-h-none flex-1">
        <CommandEmpty>No proteins match.</CommandEmpty>
        {nodes.map((node) => {
          const isSelected = selectedIds.has(node.id);
          return (
            <CommandItem
              key={node.id}
              value={`${node.gene ?? ""} ${node.id}`}
              onSelect={() => {
                onSelectNode(node);
              }}
              data-app-selected={isSelected}
              // Neutralise cmdk's own data-selected cursor so the app selection is the single
              // highlight, forced to win when both apply.
              variant="app-selection"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full bg-(--dot-color)"
                style={
                  {
                    "--dot-color": isSelected
                      ? colors.selected
                      : node.kind === "host"
                        ? colors.host
                        : colors.microbial,
                  } as CSSProperties
                }
              />
              <span className="truncate">{node.gene || node.id}</span>
            </CommandItem>
          );
        })}
      </CommandList>
    </Command>
  );
}
