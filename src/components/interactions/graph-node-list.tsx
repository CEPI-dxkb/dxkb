"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { SearchIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { computeShiftRangeIds } from "@/components/shared/data-table-utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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

// A row is `h-8` (2rem) tall: the height the virtualizer lays rows out by, and the one the bar
// behind it (`top-1 h-6`) is sized for. The overscan keeps a few rows drawn past each edge so a
// fast scroll or an arrow-key repeat does not show a blank strip.
const rowHeight = 32;
const rowOverscan = 10;

interface PickModifiers {
  additive: boolean;
  range: boolean;
}

// Sigma wires only pointer events, so this list is the keyboard path to a node (and, via the detail
// panel, its edges). Proteins are ranked by how many interactions they take part in, and the bar
// behind a row splits that count into verified (indigo) and predicted (grey), as in the legend.
//
// A Graph can hold ten thousand proteins, so only the rows in view (and a few past each edge) are
// drawn: a row is about ten elements, and drawing them all made every redraw of the graph lay out,
// scroll and walk (an assistive technology, a test's locators) a list nobody reads in full. Each
// drawn row carries its place in the whole list (`aria-posinset` of `aria-setsize`), so an assistive
// technology still hears "3 of 10,000". Search reaches every protein.
//
// It is a combobox over a listbox: focus stays in the search box and the arrow keys move a cursor
// (`aria-activedescendant`) over the rows, which Enter picks. The cursor is not the selection: the
// selection can hold several proteins, and is reported as `aria-selected` on each of them.
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
  "use no memo";
  const listId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // The cursor's row, in the matches' order. The row Enter picks; the first match until moved.
  const [cursor, setCursor] = useState(0);
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
  const maxDegree = useMemo(() => {
    let most = 1;
    for (const { degree } of stats.values()) most = Math.max(most, degree);
    return most;
  }, [stats]);
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  // A substring match over name, product, locus tag, genome and BRC ID, in rank order. A fuzzy
  // score would match "rpsL" inside a long product name and re-sort by score, which would undo the
  // ranking.
  const query = search.trim().toLowerCase();
  const matches = useMemo(
    () => rows.filter((row) => row.searchText.includes(query)),
    [rows, query],
  );
  // The nodes can change under the cursor (a filter), so it is held inside the list.
  const activeIndex = matches.length === 0 ? -1 : Math.min(cursor, matches.length - 1);

  // Held stable: the virtualizer lays out every row again whenever this function changes, and the
  // list re-renders on each scroll frame.
  const getItemKey = useCallback(
    (index: number) => matches[index]?.node.id ?? index,
    [matches],
  );
  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: rowOverscan,
    getItemKey,
  });
  const virtualRows = virtualizer.getVirtualItems();

  // The anchor must still be selected: a selection made on the canvas leaves the last list click
  // behind, and a lone selected protein is the natural start of a range whoever chose it.
  function rangeAnchor(): string | null {
    const anchor = anchorRef.current;
    if (anchor !== null && selectedIds.has(anchor)) return anchor;
    return selectedIds.size === 1 ? ([...selectedIds][0] ?? null) : null;
  }

  function chooseNode(node: GNode, { additive, range }: PickModifiers) {
    const anchor = rangeAnchor();
    if (range && anchor !== null) {
      // The range runs through the rows the list holds, in order, drawn or not.
      const listed = matches.map((row) => ({ id: row.node.id }));
      const inRange = computeShiftRangeIds(listed, anchor, node.id)
        .map((id) => nodesById.get(id))
        .filter((member) => member !== undefined);
      // An anchor that is not listed (filtered out by the search) gives no range, and the click
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

  function moveCursor(index: number) {
    setCursor(index);
    virtualizer.scrollToIndex(index, { align: "auto" });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // A key that picks a candidate inside an input method's composition is not ours.
    if (event.nativeEvent.isComposing) return;
    const last = matches.length - 1;
    const page = Math.max(
      1,
      Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight) - 1,
    );
    switch (event.key) {
      case "ArrowDown":
        moveCursor(Math.min(activeIndex + 1, last));
        break;
      case "ArrowUp":
        moveCursor(Math.max(activeIndex - 1, 0));
        break;
      case "PageDown":
        moveCursor(Math.min(activeIndex + page, last));
        break;
      case "PageUp":
        moveCursor(Math.max(activeIndex - page, 0));
        break;
      case "Home":
        moveCursor(0);
        break;
      case "End":
        moveCursor(Math.max(last, 0));
        break;
      case "Enter": {
        const row = matches[activeIndex] as (typeof matches)[number] | undefined;
        if (row) {
          // Only a click ranges: as in the table, Shift with the keyboard does something else.
          chooseNode(row.node, {
            additive: event.metaKey || event.ctrlKey,
            range: false,
          });
        }
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  // A selection made elsewhere (the canvas, the URL) brings its row into view. It reads the list
  // through an event so that typing in the search box, which changes the matches, does not pull the
  // list back to the selected protein.
  const scrollToSelected = useEffectEvent(() => {
    if (selectedIds.size !== 1) return;
    const [id] = selectedIds;
    const index = matches.findIndex((row) => row.node.id === id);
    if (index !== -1) virtualizer.scrollToIndex(index, { align: "auto" });
  });
  useEffect(() => {
    scrollToSelected();
  }, [selectedIds]);

  const activeRow = virtualRows.find((row) => row.index === activeIndex);

  return (
    <div
      data-slot="graph-node-list"
      className="flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground"
    >
      <div className="p-1 pb-0">
        <InputGroup>
          <InputGroupInput
            role="combobox"
            aria-label="Search proteins"
            aria-expanded
            aria-autocomplete="list"
            aria-controls={matches.length > 0 ? listId : undefined}
            aria-activedescendant={
              activeRow ? `${listId}-${String(activeRow.index)}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
            placeholder="Search proteins…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              // A new search starts at the best match, from the top of the list.
              setCursor(0);
              virtualizer.scrollToOffset(0);
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              setSearchFocused(true);
            }}
            onBlur={() => {
              setSearchFocused(false);
            }}
          />
          <InputGroupAddon>
            <SearchIcon className="size-4 shrink-0 opacity-50" />
          </InputGroupAddon>
        </InputGroup>
      </div>
      <p
        className="px-3 py-1.5 text-2xs text-muted-foreground"
        title="The bar behind each row splits its interactions into verified (indigo) and predicted (grey), as in the legend."
      >
        Ranked by interactions
      </p>
      <div
        ref={scrollRef}
        className="scrollbar-themed min-h-0 flex-1 overflow-x-hidden overflow-y-auto outline-none"
        // A modified press would start a text selection or move focus; the table stops both too.
        onMouseDown={(event) => {
          if (event.shiftKey) event.preventDefault();
        }}
      >
        {matches.length === 0 ? (
          <p className="py-6 text-center text-sm">No proteins match.</p>
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-label="Interaction network nodes"
            aria-multiselectable
            className="relative h-(--list-height) w-full"
            style={
              {
                "--list-height": `${String(virtualizer.getTotalSize())}px`,
              } as CSSProperties
            }
          >
            {virtualRows.map((virtualRow) => {
              const { node, rank } = matches[virtualRow.index];
              const isSelected = selectedIds.has(node.id);
              const isCursor = searchFocused && virtualRow.index === activeIndex;
              const { degree, experimental } = statsOf(stats, node);
              const label = nodeLabel(node);
              const product = nodeProduct(node);
              return (
                <div
                  key={virtualRow.key}
                  id={`${listId}-${String(virtualRow.index)}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-posinset={virtualRow.index + 1}
                  aria-setsize={matches.length}
                  // The name stays the protein's, not the rank and count beside it; the title is
                  // its description and the tooltip that says what the protein is.
                  aria-label={label}
                  title={[
                    product || "No product annotation",
                    `${plural(degree, "interaction", "interactions")}, ${String(experimental)} verified`,
                  ].join(" · ")}
                  data-node-id={node.id}
                  data-app-selected={isSelected}
                  data-cursor={isCursor}
                  onClick={(event) => {
                    setCursor(virtualRow.index);
                    chooseNode(node, {
                      additive: event.metaKey || event.ctrlKey,
                      range: event.shiftKey,
                    });
                  }}
                  className="absolute inset-x-0 top-(--row-top) flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-sm select-none hover:bg-secondary/15 data-[app-selected=true]:bg-secondary/25 data-[app-selected=true]:font-medium data-[cursor=true]:ring-2 data-[cursor=true]:ring-ring/70 data-[cursor=true]:ring-inset"
                  style={
                    {
                      "--row-top": `${String(virtualRow.start)}px`,
                    } as CSSProperties
                  }
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
                      style={
                        { "--predicted-color": colors.dim } as CSSProperties
                      }
                    />
                  </span>
                  {/* The rank and the count are drawn from their data attributes (globals.css), so
                      the row's visible text is its name alone: an accessible name must contain the
                      visible text (WCAG 2.5.3), and the name is the protein's label. The count is
                      in the row's description, its title. */}
                  <span
                    aria-hidden
                    data-slot="graph-node-rank"
                    data-rank={rank}
                    className="relative w-5 shrink-0 text-right text-2xs text-muted-foreground tabular-nums"
                  />
                  <GraphNodeDot node={node} selected={isSelected} />
                  <span className="relative min-w-0 flex-1 truncate">
                    {label}
                  </span>
                  <span
                    aria-hidden
                    data-slot="graph-node-degree"
                    data-degree={degree}
                    className="relative shrink-0 text-xs tabular-nums"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
