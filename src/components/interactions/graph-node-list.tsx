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

// Keyboard-operable equivalent of clicking a node on the WebGL canvas. Sigma
// only wires pointer events, so this list is the sole path to reach a node
// (and, via the detail panel, its edges) without a mouse. Selecting here drives
// the same selection sink as clickNode, keeping canvas and list in lockstep.
export function GraphNodeList({
  nodes,
  selectedIds,
  onSelectNode,
}: GraphNodeListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // cmdk's own `data-selected` cursor follows the pointer, which visually
  // competed with the app selection and highlighted whatever was last hovered
  // rather than the node clicked on the graph. We disable pointer selection so
  // that phantom highlight can't wander, and style the app selection through a
  // separate data attribute below. On a graph→list selection change, scroll the
  // selected row into view so the two stay in sync.
  useEffect(() => {
    if (selectedIds.size !== 1) return;
    const el = listRef.current?.querySelector('[data-app-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIds]);

  return (
    <Command
      // cmdk defaults to its own fuzzy filter over each item's `value`; we set
      // value to gene + id so both are searchable.
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
              // cmdk keeps its own `data-selected` cursor (mount first-item,
              // keyboard, click) independent of the app selection, which showed
              // as a competing highlight on the wrong row. Neutralise it and let
              // the app selection, driven equally by canvas clicks and this list,
              // be the single amber highlight, forced to win when a row is both
              // cmdk-focused and app-selected.
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
