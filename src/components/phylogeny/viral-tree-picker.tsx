import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildTreeRows,
  choiceKey,
  filterViralTrees,
  flattenViralTrees,
  pruneViralFilters,
  segmentLabel,
  sortedSegments,
  viewerLabel,
  viralFacetCounts,
  type NextstrainInventory,
  type PhyloViewer,
  type TreeRow,
  type ViewerSlot,
  type ViralFilters,
  type ViralTreeChoice,
} from "@/lib/phylogeny/viral-facets";
import {
  resolvePhylogenyUrl,
  type PhyloFamilyBlock,
} from "@/lib/services/organisms/phylogeny";

export type { NextstrainInventory };

const viewers = Object.keys(viewerLabel) as PhyloViewer[];

/** Label and tooltip for an Auspice dataset that cannot be opened yet. */
const pendingSlot: Record<
  Exclude<ViewerSlot["state"], "open" | "none">,
  { label: string; title: string }
> = {
  checking: {
    label: "Checking Availability",
    title: "Auspice dataset availability has not been confirmed",
  },
  unconfirmed: {
    label: "Availability Unconfirmed",
    title: "Auspice dataset availability could not be confirmed",
  },
  missing: {
    label: "Not Available",
    title: "Auspice dataset is not available",
  },
};

function isViewer(value: unknown): value is PhyloViewer {
  return value === "archaeopteryx" || value === "nextstrain";
}

interface FilterProps {
  trees: ViralTreeChoice[];
  filters: ViralFilters;
  update: (next: ViralFilters) => void;
}

export function ViralTreePicker({
  block,
  nextstrainInventory,
  focusChoiceKey,
  onOpen,
}: {
  block: PhyloFamilyBlock;
  nextstrainInventory: NextstrainInventory;
  focusChoiceKey?: string;
  onOpen: (choice: ViralTreeChoice) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trees = flattenViralTrees(block);
  const [filters, setFilters] = useState<ViralFilters>({
    strain: null,
    viewer: null,
    segments: new Set(),
  });
  const update = (next: ViralFilters) => {
    setFilters(pruneViralFilters(trees, next));
  };
  const rows = buildTreeRows(
    filterViralTrees(trees, filters),
    nextstrainInventory,
  );
  const total = buildTreeRows(trees, nextstrainInventory).length;
  // A viewer filter drops the other viewer's column instead of leaving it blank.
  const shownViewers = filters.viewer ? [filters.viewer] : viewers;

  useEffect(() => {
    if (!focusChoiceKey) return;
    [
      ...(containerRef.current?.querySelectorAll<HTMLElement>(
        "[data-choice-key]",
      ) ?? []),
    ]
      .find((element) => element.dataset.choiceKey === focusChoiceKey)
      ?.focus();
  }, [focusChoiceKey]);

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
    >
      <h2 className="sr-only">Available phylogenetic trees</h2>
      {/* Below lg the sidebar would stack above the table and push it off
          screen, so a one-line filter bar takes its place. */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[260px_1fr]">
        <SidebarFilters trees={trees} filters={filters} update={update} />
        <div className="flex min-h-0 flex-1 flex-col">
          <BarFilters
            trees={trees}
            filters={filters}
            update={update}
            shown={rows.length}
            total={total}
          />
          {nextstrainInventory.status !== "ready" && (
            <p
              role="status"
              className="border-b px-4 py-2 text-sm text-muted-foreground"
            >
              {nextstrainInventory.status === "pending"
                ? "Checking Auspice dataset availability..."
                : `Auspice dataset availability could not be checked: ${nextstrainInventory.message}`}
            </p>
          )}
          <div
            data-slot="tree-results-scroll"
            className="min-h-0 flex-1 overflow-auto"
          >
            {rows.length === 0 ? (
              <p className="grid min-h-64 place-items-center p-5 text-sm text-muted-foreground">
                No trees found for the selected filters.
              </p>
            ) : (
              <TreeTable rows={rows} viewers={shownViewers} onOpen={onOpen} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
      {value}
    </span>
  );
}

function useFacets(trees: ViralTreeChoice[], filters: ViralFilters) {
  return {
    strains: [
      ...new Map(trees.map((tree) => [tree.groupKey, tree.groupTitle])),
    ],
    hasViewerChoice: new Set(trees.map((tree) => tree.viewer)).size > 1,
    segments: sortedSegments(trees),
    counts: viralFacetCounts(trees, filters),
  };
}

function StrainOptions({ trees, filters, update }: FilterProps) {
  const { strains, counts } = useFacets(trees, filters);
  return (
    // grid-cols-1 pins the column to its container; otherwise the auto column
    // sizes to the longest strain name.
    <RadioGroup
      className="grid-cols-1"
      value={filters.strain ?? "all"}
      onValueChange={(value: unknown) => {
        if (typeof value === "string")
          update({ ...filters, strain: value === "all" ? null : value });
      }}
    >
      <Label>
        <RadioGroupItem value="all" />
        All strains
        <Count value={counts.allStrains} />
      </Label>
      {/* Never disabled: leaving strain unconstrained means picking a viewer
          cannot lock the user out of a strain. */}
      {strains.map(([key, title]) => (
        <Label key={key}>
          <RadioGroupItem value={key} />
          <span className="min-w-0 truncate" title={title}>
            {title}
          </span>
          <Count value={counts.strain(key)} />
        </Label>
      ))}
    </RadioGroup>
  );
}

function ViewerOptions({ trees, filters, update }: FilterProps) {
  const { counts } = useFacets(trees, filters);
  return (
    <RadioGroup
      value={filters.viewer ?? "all"}
      onValueChange={(value: unknown) => {
        if (value === "all" || isViewer(value))
          update({ ...filters, viewer: value === "all" ? null : value });
      }}
    >
      <Label>
        <RadioGroupItem value="all" />
        All viewers
        <Count value={counts.allViewers} />
      </Label>
      {viewers.map((viewer) => (
        <Label key={viewer}>
          <RadioGroupItem
            value={viewer}
            disabled={counts.viewer(viewer) === 0}
          />
          {viewerLabel[viewer]}
          <Count value={counts.viewer(viewer)} />
        </Label>
      ))}
    </RadioGroup>
  );
}

function SegmentOptions({ trees, filters, update }: FilterProps) {
  const { segments, counts } = useFacets(trees, filters);
  return (
    <div className="space-y-2">
      {segments.map((segment) => (
        <Label key={segment}>
          <Checkbox
            checked={filters.segments.has(segment)}
            disabled={counts.segment(segment) === 0}
            onCheckedChange={(checked) => {
              const next = new Set(filters.segments);
              if (checked) next.add(segment);
              else next.delete(segment);
              update({ ...filters, segments: next });
            }}
          />
          {segmentLabel(segment)}
          <Count value={counts.segment(segment)} />
        </Label>
      ))}
    </div>
  );
}

function SidebarFilters(props: FilterProps) {
  const { hasViewerChoice, segments } = useFacets(props.trees, props.filters);
  return (
    <aside className="hidden space-y-5 border-r p-4 lg:block lg:min-h-0 lg:overflow-y-auto">
      <h3 className="text-sm font-semibold">Filters</h3>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-muted-foreground">
          Strain
        </legend>
        <StrainOptions {...props} />
      </fieldset>
      {hasViewerChoice && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">
            Viewer
          </legend>
          <ViewerOptions {...props} />
        </fieldset>
      )}
      {segments.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">
            Segment
          </legend>
          <SegmentOptions {...props} />
        </fieldset>
      )}
    </aside>
  );
}

/** Small-screen filter: an outline button showing the choice, opening its list. */
function BarFilter({
  label,
  summary,
  onClear,
  children,
}: {
  label: string;
  summary: string;
  onClear: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <Popover>
      {/* The visible "Strain All" is the accessible name; an aria-label that
          differs from it fails axe's label-content-name-mismatch. */}
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <span className="text-muted-foreground">{label}</span>{" "}
        <span className="max-w-40 truncate">{summary}</span>
        <ChevronDown aria-hidden className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {onClear && (
            <Button variant="ghost" size="xs" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function BarFilters({
  shown,
  total,
  ...props
}: FilterProps & { shown: number; total: number }) {
  const { filters, update } = props;
  const { strains, hasViewerChoice, segments } = useFacets(
    props.trees,
    filters,
  );
  const chosen = segments.filter((segment) => filters.segments.has(segment));
  const chosenLabels = chosen.map(segmentLabel);
  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 lg:hidden"
    >
      <BarFilter
        label="Strain"
        summary={strains.find(([key]) => key === filters.strain)?.[1] ?? "All"}
        onClear={
          filters.strain
            ? () => {
                update({ ...filters, strain: null });
              }
            : null
        }
      >
        <StrainOptions {...props} />
      </BarFilter>
      {hasViewerChoice && (
        <BarFilter
          label="Viewer"
          summary={filters.viewer ? viewerLabel[filters.viewer] : "All"}
          onClear={
            filters.viewer
              ? () => {
                  update({ ...filters, viewer: null });
                }
              : null
          }
        >
          <ViewerOptions {...props} />
        </BarFilter>
      )}
      {segments.length > 1 && (
        <BarFilter
          label="Segment"
          summary={
            chosen.length === 0
              ? "Any"
              : chosen.length <= 2
                ? chosenLabels.join(", ")
                : `${chosenLabels.slice(0, 2).join(", ")} +${String(chosen.length - 2)}`
          }
          onClear={
            chosen.length > 0
              ? () => {
                  update({ ...filters, segments: new Set() });
                }
              : null
          }
        >
          <SegmentOptions {...props} />
        </BarFilter>
      )}
      <span className="ml-auto text-sm text-muted-foreground">
        {shown} of {total} trees
      </span>
    </div>
  );
}

function TreeTable({
  rows,
  viewers: shownViewers,
  onOpen,
}: {
  rows: TreeRow[];
  viewers: PhyloViewer[];
  onOpen: (choice: ViralTreeChoice) => void;
}) {
  const hasSegments = rows.some((row) => row.segment !== null);
  return (
    <Table disableScrollWrapper>
      <TableHeader variant="muted" className="sticky top-0 z-10">
        <TableRow variant="static">
          {/* h-8.5 matches a body row: an h-6 button, py-1, and its line box. */}
          <TableHead variant="divider-strong" className="h-8.5 px-4">
            Name
          </TableHead>
          <TableHead variant="divider-strong" className="h-8.5 px-4">
            Strain
          </TableHead>
          {hasSegments && (
            <TableHead variant="divider-strong" className="h-8.5 w-24 px-4">
              Segment
            </TableHead>
          )}
          {shownViewers.map((viewer) => (
            <TableHead
              key={viewer}
              variant="divider-strong"
              className="h-8.5 w-36 px-4"
            >
              {viewerLabel[viewer]}
            </TableHead>
          ))}
          <TableHead className="h-8.5 w-24 px-4 text-center">
            Metadata
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const metadataUrl = row.metadata
            ? resolvePhylogenyUrl(row.metadata)
            : null;
          return (
            <TableRow key={row.key} data-slot="tree-row" className="h-8">
              <TableCell variant="divider-strong" className="px-4 py-1">
                <span className="font-medium">{row.name}</span>
              </TableCell>
              <TableCell variant="divider-strong" className="px-4 py-1">
                {row.strainTitle}
              </TableCell>
              {hasSegments && (
                <TableCell variant="divider-strong" className="px-4 py-1">
                  <span className="font-mono text-xs">
                    {row.segment ? segmentLabel(row.segment) : "—"}
                  </span>
                </TableCell>
              )}
              {shownViewers.map((viewer) => (
                <TableCell
                  key={viewer}
                  variant="divider-strong"
                  className="px-4 py-1"
                >
                  <ViewerCell
                    slot={row.slots[viewer]}
                    viewer={viewer}
                    onOpen={onOpen}
                  />
                </TableCell>
              ))}
              <TableCell className="px-4 py-1 text-center">
                {metadataUrl && (
                  <MetadataLink url={metadataUrl} name={row.name} />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ViewerCell({
  slot,
  viewer,
  onOpen,
}: {
  slot: ViewerSlot;
  viewer: PhyloViewer;
  onOpen: (choice: ViralTreeChoice) => void;
}) {
  if (slot.state === "none") return null;
  if (slot.state !== "open") {
    const { label, title } = pendingSlot[slot.state];
    return (
      <span
        title={title}
        className="cursor-not-allowed text-xs text-muted-foreground"
      >
        {label}
      </span>
    );
  }
  const { choice } = slot;
  return (
    <Button
      variant="outline"
      size="xs"
      className="w-28"
      data-choice-key={choiceKey(choice)}
      aria-label={`Open ${choice.ref.name} in ${viewerLabel[viewer]}`}
      onClick={() => {
        onOpen(choice);
      }}
    >
      Open
    </Button>
  );
}

function MetadataLink({ url, name }: { url: string; name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Download metadata for ${name}`}
            className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
          />
        }
      >
        <Download />
      </TooltipTrigger>
      <TooltipContent>Download metadata</TooltipContent>
    </Tooltip>
  );
}
