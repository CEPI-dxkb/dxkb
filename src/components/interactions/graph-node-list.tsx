"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { computeShiftRangeIds } from "@/components/shared/data-table-utils";
import { colors } from "@/lib/interactions/graph-theme";
import {
  buildNodeStats,
  nodeLabel,
  nodeProduct,
  nodeSearchText,
  plural,
  rankByLinks,
  statsOf,
} from "@/lib/interactions/node-insight";
import type { GEdge, GNode } from "@/lib/interactions/types";

import { GraphNodeDot } from "./graph-node-dot";

interface GraphNodeListProps {
  nodes: GNode[];
  selectedIds: ReadonlySet<string>;
  /** Every interaction a protein takes part in, by protein id: what the ranking and bars count. */
  incidence: ReadonlyMap<string, readonly GEdge[]>;
  onSelectNode: (node: GNode, additive: boolean) => void;
  /** Shift-click: these proteins, in the list's order, become the whole selection. */
  onSelectRange: (nodes: GNode[]) => void;
}

// A substring match over name, product, locus tag, genome and BRC ID. cmdk's own fuzzy scoring would
// match "rpsL" inside a long product name, and it re-sorts by score, which would undo the ranking.
function filterNodes(value: string, search: string): number {
  return value.includes(search.trim().toLowerCase()) ? 1 : 0;
}

// Sigma wires only pointer events, so this list is the keyboard path to a node (and, via the detail
// panel, its edges). Proteins are ranked by how many interactions they take part in, and the bar
// behind a row splits that count into verified (indigo) and predicted (grey), as in the legend.
//
// Clicks select as the data table's rows do: a plain click selects one protein, Cmd/Ctrl-click adds
// or removes one, and Shift-click selects every protein from the last one clicked to this one.
export function GraphNodeList({
  nodes,
  selectedIds,
  incidence,
  onSelectNode,
  onSelectRange,
}: GraphNodeListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // cmdk's onSelect carries no event, so the modifier keys are captured on the root (capture phase,
  // so they are set before cmdk's own click/Enter handlers run) and read when a row is chosen. Only
  // a click ranges: as in the table, Shift with the keyboard does something else.
  const modifiersRef = useRef({ additive: false, range: false });
  // The protein a Shift-click ranges from: the last one chosen with a plain or Cmd/Ctrl click.
  const anchorRef = useRef<string | null>(null);

  const stats = useMemo(
    () => buildNodeStats(nodes, incidence),
    [nodes, incidence],
  );
  const rows = useMemo(
    () =>
      rankByLinks(nodes, stats).map((node, index) => ({
        node,
        rank: index + 1,
        searchText: nodeSearchText(node),
      })),
    [nodes, stats],
  );
  const maxDegree = Math.max(1, ...[...stats.values()].map((s) => s.degree));
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  // The anchor must still be selected: a selection made on the canvas leaves the last list click
  // behind, and a lone selected protein is the natural start of a range whoever chose it.
  function rangeAnchor(): string | null {
    const anchor = anchorRef.current;
    if (anchor !== null && selectedIds.has(anchor)) return anchor;
    return selectedIds.size === 1 ? ([...selectedIds][0] ?? null) : null;
  }

  // The rows on screen, in order: cmdk renders only those matching the search, so the DOM is the
  // list a range runs through.
  function visibleRows(): { id: string }[] {
    const rowsInView =
      listRef.current?.querySelectorAll<HTMLElement>("[data-node-id]") ?? [];
    return [...rowsInView].map((row) => ({ id: row.dataset.nodeId ?? "" }));
  }

  function chooseNode(node: GNode) {
    const { additive, range } = modifiersRef.current;
    const anchor = rangeAnchor();
    if (range && anchor !== null) {
      const inRange = computeShiftRangeIds(visibleRows(), anchor, node.id)
        .map((id) => nodesById.get(id))
        .filter((member) => member !== undefined);
      // An anchor the search has filtered out gives no range, and the click is a plain one.
      if (inRange.length > 0) {
        onSelectRange(inRange);
        return;
      }
    }
    anchorRef.current = node.id;
    onSelectNode(node, additive);
  }

  // cmdk's own data-selected cursor follows the pointer and competes with the app selection, so
  // pointer selection is disabled; selection changes scroll the row into view.
  useEffect(() => {
    if (selectedIds.size !== 1) return;
    const el = listRef.current?.querySelector('[data-app-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIds]);

  return (
    <Command
      label="Interaction network nodes"
      className="h-full"
      filter={filterNodes}
      disablePointerSelection
      onClickCapture={(event) => {
        modifiersRef.current = {
          additive: event.metaKey || event.ctrlKey,
          range: event.shiftKey,
        };
      }}
      onKeyDownCapture={(event) => {
        modifiersRef.current = {
          additive: event.metaKey || event.ctrlKey,
          range: false,
        };
      }}
      // A modified press would start a text selection or move focus; the table stops both too.
      onMouseDownCapture={(event) => {
        if (event.shiftKey) event.preventDefault();
      }}
    >
      <CommandInput placeholder="Search proteins…" />
      <p
        className="px-3 py-1.5 text-2xs text-muted-foreground"
        title="The bar behind each row splits its interactions into verified (indigo) and predicted (grey), as in the legend."
      >
        Ranked by interactions
      </p>
      <CommandList
        ref={listRef}
        className="max-h-none flex-1"
        aria-multiselectable
      >
        <CommandEmpty>No proteins match.</CommandEmpty>
        {rows.map(({ node, rank, searchText }) => {
          const isSelected = selectedIds.has(node.id);
          const { degree, experimental } = statsOf(stats, node);
          const label = nodeLabel(node);
          const product = nodeProduct(node);
          return (
            <CommandItem
              key={node.id}
              value={searchText}
              onSelect={() => {
                chooseNode(node);
              }}
              data-node-id={node.id}
              data-app-selected={isSelected}
              // cmdk owns `aria-selected` for its own cursor row, so the app selection (which can
              // hold several rows) is exposed as `aria-checked`, which `option` supports.
              aria-checked={isSelected}
              // The name stays the protein's, not the rank and count beside it; the title is its
              // description and the tooltip that says what the protein is.
              aria-label={label}
              title={[
                product || "No product annotation",
                `${plural(degree, "interaction", "interactions")}, ${String(experimental)} verified`,
              ].join(" · ")}
              // Neutralise cmdk's own data-selected cursor so the app selection is the single
              // highlight, forced to win when both apply.
              variant="app-selection"
            >
              <span
                aria-hidden
                data-slot="graph-node-bar"
                className="absolute top-1 left-0 flex h-6 w-(--bar-width) opacity-20"
                style={
                  {
                    "--bar-width": `${String((degree / maxDegree) * 100)}%`,
                  } as CSSProperties
                }
              >
                <span
                  className="h-full w-(--verified-share) bg-(--verified-color)"
                  style={
                    {
                      "--verified-share": `${String(degree ? (experimental / degree) * 100 : 0)}%`,
                      "--verified-color": colors.edgeExperimental,
                    } as CSSProperties
                  }
                />
                <span
                  className="h-full flex-1 bg-(--predicted-color)"
                  style={{ "--predicted-color": colors.dim } as CSSProperties}
                />
              </span>
              <span className="relative w-5 shrink-0 text-right text-2xs text-muted-foreground tabular-nums">
                {rank}
              </span>
              <GraphNodeDot node={node} selected={isSelected} />
              <span className="relative min-w-0 flex-1 truncate">{label}</span>
              <span className="relative shrink-0 text-xs tabular-nums">
                {degree}
              </span>
            </CommandItem>
          );
        })}
      </CommandList>
    </Command>
  );
}
