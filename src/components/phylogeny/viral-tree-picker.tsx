import { CircleOff, Download, Filter } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  choiceKey,
  filterViralTrees,
  flattenViralTrees,
  isUnavailable,
  pruneViralFilters,
  segmentColor,
  segmentRows,
  sortedSegments,
  viewerLabel,
  viralFacetCounts,
  type PhyloViewer,
  type SegmentRow,
  type ViralFilters,
  type ViralTreeChoice,
} from "@/lib/phylogeny/viral-facets";
import {
  resolvePhylogenyUrl,
  type PhyloFamilyBlock,
} from "@/lib/services/organisms/phylogeny";

// Label styling for an option whose facet count is zero. Base UI renders its
// radio/checkbox as a <span role> with aria-disabled rather than a natively
// disabled control, so match on that instead of `peer-disabled:`.
const disabledOption =
  "has-aria-disabled:cursor-not-allowed has-aria-disabled:opacity-50";
const viewerEntries = Object.entries(viewerLabel) as [PhyloViewer, string][];
const viewers = Object.keys(viewerLabel) as PhyloViewer[];

export type NextstrainInventory =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "ready"; ids: ReadonlySet<string> };

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
  const strains = [
    ...new Map(trees.map((tree) => [tree.groupKey, tree.groupTitle])).entries(),
  ];
  const availableViewers = [...new Set(trees.map((tree) => tree.viewer))];
  // Full segment list so options stay put; unavailable ones are disabled below
  // rather than disappearing.
  const segments = sortedSegments(trees);
  const visible = filterViralTrees(trees, filters);
  const counts = viralFacetCounts(trees, filters);

  const update = (next: ViralFilters) => {
    setFilters(pruneViralFilters(trees, next));
  };

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
      className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/15"
    >
      <div className="border-b bg-background px-5 py-4">
        <h2 className="text-lg font-semibold">Available phylogenetic trees</h2>
        <p className="text-sm text-muted-foreground">
          Choose a strain, viewer, and genome segment.
        </p>
      </div>
      {/* lg: each column scrolls independently so Filters stay pinned; below lg
          the stacked layout scrolls as one column. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[260px_1fr] lg:overflow-hidden">
        <aside className="border-b bg-background p-4 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Filter className="size-4" /> Filters
              </span>
              <Badge variant="secondary">{visible.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-5 pt-4">
              <fieldset>
                <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Strain
                </legend>
                {/* grid-cols-1 pins the column to the sidebar width; without it
                    the auto column sizes to the longest strain name and pushes
                    the count out of view. */}
                <RadioGroup
                  className="grid-cols-1"
                  value={filters.strain ?? "all"}
                  onValueChange={(value: unknown) => {
                    if (typeof value === "string")
                      update({
                        ...filters,
                        strain: value === "all" ? null : value,
                      });
                  }}
                >
                  <Label>
                    <RadioGroupItem value="all" />
                    All strains{" "}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {counts.allStrains}
                    </span>
                  </Label>
                  {/* Never disabled: `strains` is derived from `trees`, so every
                      row has at least one tree, and leaving strain unconstrained
                      means picking a viewer can't lock the user out of a strain. */}
                  {strains.map(([key, title]) => (
                    <Label key={key}>
                      <RadioGroupItem value={key} />
                      <span className="min-w-0 truncate" title={title}>
                        {title}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {counts.strain(key)}
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
              {availableViewers.length > 1 && (
                <fieldset>
                  <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Viewer
                  </legend>
                  <RadioGroup
                    value={filters.viewer ?? "all"}
                    onValueChange={(value: unknown) => {
                      if (
                        value === "all" ||
                        value === "archaeopteryx" ||
                        value === "nextstrain"
                      ) {
                        update({
                          ...filters,
                          viewer: value === "all" ? null : value,
                        });
                      }
                    }}
                  >
                    <Label>
                      <RadioGroupItem value="all" />
                      All viewers{" "}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {counts.allViewers}
                      </span>
                    </Label>
                    {viewerEntries.map(([value, title]) => {
                      const count = counts.viewer(value);
                      return (
                        <Label key={value} className={disabledOption}>
                          <RadioGroupItem
                            value={value}
                            disabled={count === 0}
                          />
                          {title}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {count}
                          </span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                </fieldset>
              )}
              {segments.length > 1 && (
                <fieldset>
                  <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Segment
                  </legend>
                  <div className="space-y-2">
                    {segments.map((segment) => {
                      const count = counts.segment(segment);
                      return (
                        <Label key={segment} className={disabledOption}>
                          <Checkbox
                            checked={filters.segments.has(segment)}
                            disabled={count === 0}
                            onCheckedChange={(checked) => {
                              const next = new Set(filters.segments);
                              if (checked) next.add(segment);
                              else next.delete(segment);
                              update({ ...filters, segments: next });
                            }}
                          />
                          {segment}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {count}
                          </span>
                        </Label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </CollapsibleContent>
          </Collapsible>
        </aside>
        <div
          data-slot="tree-results-scroll"
          className="lg:min-h-0 lg:overflow-y-auto"
        >
          {nextstrainInventory.status !== "ready" && (
            <div
              className="border-b bg-background px-5 py-3 text-sm text-muted-foreground"
              role="status"
            >
              {nextstrainInventory.status === "pending"
                ? "Checking Auspice dataset availability..."
                : `Auspice dataset availability could not be checked: ${nextstrainInventory.message}`}
            </div>
          )}
          <TreeResults
            visible={visible}
            nextstrainInventory={nextstrainInventory}
            onOpen={onOpen}
          />
        </div>
      </div>
    </div>
  );
}

function TreeResults({
  visible,
  nextstrainInventory,
  onOpen,
}: {
  visible: ViralTreeChoice[];
  nextstrainInventory: NextstrainInventory;
  onOpen: (choice: ViralTreeChoice) => void;
}) {
  const rows = segmentRows(visible);
  const multiStrain = new Set(rows.map((row) => row.strainKey)).size > 1;

  if (rows.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center p-5 text-center text-sm text-muted-foreground">
        No trees found for the selected filters.
      </div>
    );
  }

  return (
    <div className="pb-6">
      {rows.map((row, index) => {
        const newStrain =
          multiStrain &&
          (index === 0 || rows[index - 1]?.strainKey !== row.strainKey);
        const primary = row.choices[0];
        const metadata = row.choices
          .map((choice) => choice.ref.metadata)
          .find(Boolean);

        return (
          <Fragment
            key={`${row.strainKey}:${row.segment ?? "none"}:${choiceKey(primary)}`}
          >
            {newStrain && (
              <StrainRule
                title={row.strainTitle}
                count={
                  visible.filter((tree) => tree.groupKey === row.strainKey)
                    .length
                }
                first={index === 0}
              />
            )}
            <div
              data-slot="tree-row"
              className="group grid grid-cols-[3.5rem_1fr] items-center gap-y-2 border-b border-border/50 px-5 py-3 transition-colors hover:bg-muted/25 lg:grid-cols-[3.5rem_1fr_auto] lg:gap-y-0 lg:py-0"
              style={{ ["--seg" as string]: segmentColor(row.segment) }}
            >
              <span
                className="relative py-1 font-mono text-xs font-semibold lg:py-3.5"
                style={{ color: segmentColor(row.segment) }}
              >
                <span
                  aria-hidden
                  className="absolute top-1/2 -left-5 h-full w-0.75 -translate-y-1/2 rounded-r-sm opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: segmentColor(row.segment) }}
                />
                {row.segment ?? "—"}
              </span>

              <span className="min-w-0 py-1 pr-6 lg:py-3.5">
                <span className="block truncate text-sm font-medium">
                  {primary.ref.name}
                </span>
                {primary.ref.definition && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {primary.ref.definition}
                  </span>
                )}
              </span>

              <span className="col-span-2 flex items-center gap-2 py-2 lg:col-span-1">
                {viewers.map((viewer) => (
                  <PeerButton
                    key={viewer}
                    viewer={viewer}
                    row={row}
                    nextstrainInventory={nextstrainInventory}
                    onOpen={onOpen}
                  />
                ))}
                <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
                <MetadataButton
                  url={metadata ? resolvePhylogenyUrl(metadata) : null}
                  name={primary.ref.name}
                />
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function StrainRule({
  title,
  count,
  first,
}: {
  title: string;
  count: number;
  first: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-5 pb-2 ${first ? "pt-4" : "pt-8"}`}
    >
      <span className="text-2xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {title}
      </span>
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-2xs text-muted-foreground/70">
        {count} trees
      </span>
    </div>
  );
}

function PeerButton({
  viewer,
  row,
  nextstrainInventory,
  onOpen,
}: {
  viewer: PhyloViewer;
  row: SegmentRow;
  nextstrainInventory: NextstrainInventory;
  onOpen: (choice: ViralTreeChoice) => void;
}) {
  const choice = row.choices.find((candidate) => candidate.viewer === viewer);
  let placeholder: { title: string; label: string } | null = null;

  if (choice && viewer === "nextstrain") {
    if (nextstrainInventory.status === "pending") {
      placeholder = {
        title: "Auspice dataset availability has not been confirmed",
        label: "Checking Availability",
      };
    } else if (nextstrainInventory.status === "error") {
      placeholder = {
        title: "Auspice dataset availability could not be confirmed",
        label: "Availability Unconfirmed",
      };
    } else if (isUnavailable(choice, nextstrainInventory.ids)) {
      placeholder = {
        title: "Auspice dataset is not available",
        label: "Not Available",
      };
    }
  }

  if (!choice || placeholder) {
    return (
      <span
        className="grid h-7 flex-1 cursor-not-allowed place-items-center rounded-md border border-dashed border-border/60 text-2xs text-muted-foreground/45 lg:w-30 lg:flex-initial"
        title={
          placeholder?.title ??
          `No ${viewerLabel[viewer]} tree for this segment`
        }
      >
        {placeholder?.label ?? "Not Available"}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-choice-key={choiceKey(choice)}
      onClick={() => {
        onOpen(choice);
      }}
      aria-label={`Open ${choice.ref.name} in ${viewerLabel[viewer]}`}
      className="h-7 flex-1 rounded-md border border-border bg-background text-xs font-medium transition-colors hover:border-(--seg)/55 hover:bg-(--seg)/14 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:w-30 lg:flex-initial"
    >
      {viewerLabel[viewer]}
    </button>
  );
}

function MetadataButton({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <CircleOff aria-hidden className="size-4 text-muted-foreground/40" />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Download metadata for ${name}`}
      className={buttonVariants({
        variant: "ghost",
        size: "icon-xs",
        className: "text-foreground/75 transition-colors hover:text-foreground",
      })}
    >
      <Download />
    </a>
  );
}
