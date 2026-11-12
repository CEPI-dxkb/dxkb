import { canonicalDatasetId } from "@/lib/phylogeny/nextstrain-dataset";
import type {
  PhyloFamilyBlock,
  PhyloTreeRef,
} from "@/lib/services/organisms/phylogeny";

export type PhyloViewer = "archaeopteryx" | "nextstrain";

export interface ViralTreeChoice {
  groupKey: string;
  groupTitle: string;
  viewer: PhyloViewer;
  segment: string | null;
  ref: PhyloTreeRef;
}

export interface ViralFilters {
  strain: string | null;
  viewer: PhyloViewer | null;
  segments: Set<string>;
}

const segmentOrder = ["All", "PB2", "PB1", "PA", "HA", "NP", "NA", "M1", "NS1"];

export function parseSegment(name: string): string | null {
  if (!name) return null;
  if (/all\s+concat/i.test(name)) return "All";
  const match = /\(([^)]+)\)/.exec(name);
  return match ? match[1].split(/[,\s]+/)[0].trim() || null : null;
}

export function flattenViralTrees(block: PhyloFamilyBlock): ViralTreeChoice[] {
  const rank = new Map((block.order ?? []).map((key, index) => [key, index]));
  return [...block.groups]
    .sort(
      (a, b) =>
        (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER),
    )
    .flatMap((group) => [
      ...(group.archaeopteryx ?? []).map((ref) => ({
        groupKey: group.key,
        groupTitle: group.title,
        viewer: "archaeopteryx" as const,
        segment: parseSegment(ref.name),
        ref,
      })),
      ...(group.nextstrain ?? []).map((ref) => ({
        groupKey: group.key,
        groupTitle: group.title,
        viewer: "nextstrain" as const,
        segment: parseSegment(ref.name),
        ref,
      })),
    ]);
}

export function filterViralTrees(
  trees: ViralTreeChoice[],
  filters: ViralFilters,
): ViralTreeChoice[] {
  return trees.filter(
    (tree) =>
      (!filters.strain || tree.groupKey === filters.strain) &&
      (!filters.viewer || tree.viewer === filters.viewer) &&
      (filters.segments.size === 0 ||
        (!!tree.segment && filters.segments.has(tree.segment))),
  );
}

export function pruneViralFilters(
  trees: ViralTreeChoice[],
  filters: ViralFilters,
): ViralFilters {
  const strain =
    filters.strain && trees.some((tree) => tree.groupKey === filters.strain)
      ? filters.strain
      : null;
  const strainTrees = trees.filter(
    (tree) => !strain || tree.groupKey === strain,
  );
  const viewer =
    filters.viewer && strainTrees.some((tree) => tree.viewer === filters.viewer)
      ? filters.viewer
      : null;
  const relevant = strainTrees.filter(
    (tree) => !viewer || tree.viewer === viewer,
  );
  const validSegments = new Set(
    relevant
      .map((tree) => tree.segment)
      .filter((value): value is string => !!value),
  );
  return {
    strain,
    viewer,
    segments: new Set(
      [...filters.segments].filter((segment) => validSegments.has(segment)),
    ),
  };
}

/** Counts per facet option, cascading strain -> viewer -> segment like pruneViralFilters; strain is counted against every tree so choosing a viewer cannot lock a strain out. */
export function viralFacetCounts(
  trees: ViralTreeChoice[],
  filters: ViralFilters,
) {
  const strainTrees = trees.filter(
    (tree) => !filters.strain || tree.groupKey === filters.strain,
  );
  const viewerTrees = strainTrees.filter(
    (tree) => !filters.viewer || tree.viewer === filters.viewer,
  );
  return {
    allStrains: trees.length,
    allViewers: strainTrees.length,
    strain: (key: string) =>
      trees.filter((tree) => tree.groupKey === key).length,
    viewer: (value: PhyloViewer) =>
      strainTrees.filter((tree) => tree.viewer === value).length,
    segment: (segment: string) =>
      viewerTrees.filter((tree) => tree.segment === segment).length,
  };
}

export function sortedSegments(trees: ViralTreeChoice[]): string[] {
  return [
    ...new Set(
      trees
        .map((tree) => tree.segment)
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => {
    const left = segmentOrder.indexOf(a);
    const right = segmentOrder.indexOf(b);
    if (left === -1 && right === -1) return a.localeCompare(b);
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  });
}

export function choiceKey(choice: ViralTreeChoice): string {
  return `${choice.viewer}:${choice.ref.path}`;
}

export function isUnavailable(
  choice: ViralTreeChoice,
  availableNextstrainIds: ReadonlySet<string>,
): boolean {
  if (choice.viewer !== "nextstrain") return false;
  const id = canonicalDatasetId(choice.ref.path);
  return !id || !availableNextstrainIds.has(id);
}

export const viewerLabel = {
  archaeopteryx: "Archaeopteryx",
  nextstrain: "Auspice",
} as const;

/** Display label for a segment; "All" is the concatenated tree, not "no filter". */
export function segmentLabel(segment: string): string {
  return segment === "All" ? "Concatenated" : segment;
}

export type NextstrainInventory =
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "ready"; ids: ReadonlySet<string> };

/** A viewer's cell in a tree row: openable, an Auspice dataset that cannot be opened yet, or no tree. */
export type ViewerSlot =
  | { state: "open"; choice: ViralTreeChoice }
  | { state: "checking" | "unconfirmed" | "missing"; choice: ViralTreeChoice }
  | { state: "none" };

export interface TreeRow {
  key: string;
  strainKey: string;
  strainTitle: string;
  segment: string | null;
  name: string;
  metadata?: string;
  slots: Record<PhyloViewer, ViewerSlot>;
}

function viewerSlot(
  choice: ViralTreeChoice | undefined,
  inventory: NextstrainInventory,
): ViewerSlot {
  if (!choice) return { state: "none" };
  if (choice.viewer === "nextstrain") {
    if (inventory.status === "pending") return { state: "checking", choice };
    if (inventory.status === "error") return { state: "unconfirmed", choice };
    if (isUnavailable(choice, inventory.ids))
      return { state: "missing", choice };
  }
  return { state: "open", choice };
}

/**
 * One row per tree, with a slot per viewer. Peers share a row when they have
 * the same strain and segment, or, unsegmented, the same name; the nth tree of
 * each viewer pairs with the nth of the other, so none is dropped.
 */
export function buildTreeRows(
  trees: ViralTreeChoice[],
  inventory: NextstrainInventory,
): TreeRow[] {
  const groups = new Map<
    string,
    Partial<Record<PhyloViewer, ViralTreeChoice>>
  >();
  const seen = new Map<string, number>();
  for (const tree of trees) {
    const base = `${tree.groupKey}\u0000${tree.segment ?? `name:${tree.ref.name.trim()}`}`;
    const nth = seen.get(`${base}\u0000${tree.viewer}`) ?? 0;
    seen.set(`${base}\u0000${tree.viewer}`, nth + 1);
    const key = `${base}\u0000${String(nth)}`;
    groups.set(key, { ...groups.get(key), [tree.viewer]: tree });
  }
  const strainOrder = [...new Set(trees.map((tree) => tree.groupKey))];
  const order = sortedSegments(trees);
  const segmentRank = (segment: string | null) =>
    segment === null ? order.length : order.indexOf(segment);
  return [...groups.entries()]
    .map(([key, byViewer]): TreeRow => {
      const choices = Object.values(byViewer);
      const primary = byViewer.archaeopteryx ?? choices[0];
      return {
        key,
        strainKey: primary.groupKey,
        strainTitle: primary.groupTitle,
        segment: primary.segment,
        name: primary.ref.name,
        metadata: choices.map((choice) => choice.ref.metadata).find(Boolean),
        slots: {
          archaeopteryx: viewerSlot(byViewer.archaeopteryx, inventory),
          nextstrain: viewerSlot(byViewer.nextstrain, inventory),
        },
      };
    })
    .sort(
      (left, right) =>
        strainOrder.indexOf(left.strainKey) -
          strainOrder.indexOf(right.strainKey) ||
        segmentRank(left.segment) - segmentRank(right.segment),
    );
}
