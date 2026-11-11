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

function hashSegment(value: string): number {
  let out = 0;
  for (const character of value) out = (out * 31 + character.charCodeAt(0)) | 0;
  return out;
}

export function segmentColor(segment: string | null): string {
  if (!segment) return "var(--muted-foreground)";
  const index = segmentOrder.indexOf(segment);
  const slot = index === -1 ? Math.abs(hashSegment(segment)) % 10 : index % 10;
  return `var(--chart-${String(slot + 1)})`;
}

export interface SegmentRow {
  strainKey: string;
  strainTitle: string;
  segment: string | null;
  choices: ViralTreeChoice[];
}

/** Segmented peers share a row; unsegmented references remain distinct. */
export function segmentRows(trees: ViralTreeChoice[]): SegmentRow[] {
  const order = sortedSegments(trees);
  const strains = [
    ...new Map(trees.map((tree) => [tree.groupKey, tree.groupTitle])).entries(),
  ];
  return strains.flatMap(([strainKey, strainTitle]) => [
    ...order.flatMap((segment) => {
      const choices = trees.filter(
        (tree) => tree.groupKey === strainKey && tree.segment === segment,
      );
      return choices.length === 0
        ? []
        : [{ strainKey, strainTitle, segment, choices }];
    }),
    ...trees.flatMap((choice) =>
      choice.groupKey === strainKey && choice.segment === null
        ? [{ strainKey, strainTitle, segment: null, choices: [choice] }]
        : [],
    ),
  ]);
}
