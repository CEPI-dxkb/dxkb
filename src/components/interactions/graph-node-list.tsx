"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { Button } from "@/components/ui/button";
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

// Rows drawn before "Show all". A row is about ten elements and a Graph can hold ten thousand
// proteins, so drawing every one made each redraw of the graph (a filter, a focus) lay out, scroll
// and walk (an assistive technology, a test's locators) a list nobody reads past its first screens.
// Search reaches every protein regardless, and a selected one is always drawn.
const rowLimit = 200;

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
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
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

  // A substring match over name, product, locus tag, genome and BRC ID, in rank order. cmdk's own
  // fuzzy scoring (`shouldFilter` is off) would match "rpsL" inside a long product name, and it
  // re-sorts by score, which would undo the ranking.
  const query = search.trim().toLowerCase();
  const matches = useMemo(
    () => rows.filter((row) => row.searchText.includes(query)),
    [rows, query],
  );
  const shown = useMemo(
    () =>
      showAll
        ? matches
        : matches.filter(
            (row, index) => index < rowLimit || selectedIds.has(row.node.id),
          ),
    [matches, showAll, selectedIds],
  );

  // The anchor must still be selected: a selection made on the canvas leaves the last list click
  // behind, and a lone selected protein is the natural start of a range whoever chose it.
  function rangeAnchor(): string | null {
    const anchor = anchorRef.current;
    if (anchor !== null && selectedIds.has(anchor)) return anchor;
    return selectedIds.size === 1 ? ([...selectedIds][0] ?? null) : null;
  }

  function chooseNode(node: GNode) {
    const { additive, range } = modifiersRef.current;
    const anchor = rangeAnchor();
    if (range && anchor !== null) {
      // The range runs through the rows on screen, in order.
      const onScreen = shown.map((row) => ({ id: row.node.id }));
      const inRange = computeShiftRangeIds(onScreen, anchor, node.id)
        .map((id) => nodesById.get(id))
        .filter((member) => member !== undefined);
      // An anchor that is not on screen (filtered out by the search) gives no range, and the click
      // is a plain one.
      if (inRange.length > 0) {
        // Keep the start of the range: one made from a canvas pick has no list click to remember,
        // and the next Shift-click must range from the same protein.
        anchorRef.current = anchor;
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
      shouldFilter={false}
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
      <CommandInput
        placeholder="Search proteins…"
        value={search}
        onValueChange={setSearch}
      />
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
        {shown.map(({ node, rank, searchText }) => {
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
              {/* The rank and the count are drawn from their data attributes (globals.css), so the row's
                  visible text is its name alone: an accessible name must contain the visible text
                  (WCAG 2.5.3), and the name is the protein's label. The count is in the row's
                  description, its title. */}
              <span
                aria-hidden
                data-slot="graph-node-rank"
                data-rank={rank}
                className="relative w-5 shrink-0 text-right text-2xs text-muted-foreground tabular-nums"
              />
              <GraphNodeDot node={node} selected={isSelected} />
              <span className="relative min-w-0 flex-1 truncate">{label}</span>
              <span
                aria-hidden
                data-slot="graph-node-degree"
                data-degree={degree}
                className="relative shrink-0 text-xs tabular-nums"
              />
            </CommandItem>
          );
        })}
      </CommandList>
      {shown.length < matches.length && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-2xs text-muted-foreground">
          <span>
            Showing {shown.length.toLocaleString()} of{" "}
            {matches.length.toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setShowAll(true);
            }}
          >
            Show all
          </Button>
        </div>
      )}
    </Command>
  );
}
