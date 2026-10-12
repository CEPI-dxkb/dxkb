import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import type { DataTableColumn } from "@/components/shared/data-table";
import {
  metadataOptions,
  type MetaCatsFormData,
  type AutoGroupItem,
} from "./meta-cats-form-schema";

export interface MetaCatsFeatureLike {
  genome_id?: string;
  patric_id?: string;
}

export interface MetaCatsGenomeLike extends Record<string, unknown> {
  genome_id: string;
  strain?: string;
}

/**
 * The Groups Grid's columns, as BV-BRC's Meta-CATS grid lists them
 * (MetaCATSStore.js). BRC ID is the feature's `patric_id`, which also keys the
 * grid's selection.
 */
export const metaCatsGroupsGridColumns: DataTableColumn[] = [
  { id: "genbank_accessions", label: "Genbank Accession" },
  { id: "strain", label: "Strain" },
  { id: "metadata", label: "Metadata" },
  { id: "group", label: "Group" },
  { id: "patric_id", label: "BRC ID" },
  { id: "genome_id", label: "Genome ID" },
];

export const metaCatsGroupsGridPageSize = 200;

/**
 * Genome fields to look up beyond the default summary (which has `strain`):
 * the grid's Genbank Accession, plus the metadata field rows are grouped by.
 */
export function metaCatsGenomeFields(metadataGroup: string): string[] {
  return ["genbank_accessions", metadataGroup];
}

/**
 * Parse year ranges string into array of ranges
 * Input format: "1998,1999-2005,2006"
 * Output: [[1998], [1999, 2005], [2006]]
 */
export function parseYearRanges(yearRangesStr: string): number[][] {
  if (!yearRangesStr || yearRangesStr.trim() === "") {
    return [];
  }

  const cleaned = yearRangesStr.replace(/\s+/g, "");
  const parts = cleaned.split(",");
  const ranges: number[][] = [];

  parts.forEach((part) => {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s, 10));
      if (!isNaN(start) && !isNaN(end)) {
        ranges.push([start, end]);
      }
    } else {
      const year = parseInt(part, 10);
      if (!isNaN(year)) {
        ranges.push([year]);
      }
    }
  });

  return ranges;
}

/**
 * Get year group labels from parsed ranges
 * First range gets "<=" prefix, last range gets ">=" prefix for single values
 */
export function getYearGroupLabels(ranges: number[][]): string[] {
  if (ranges.length === 0) return [];

  const labels: string[] = [];

  // First range
  if (ranges[0].length === 1) {
    labels.push(`<=${String(ranges[0][0])}`);
  } else {
    labels.push(`${String(ranges[0][0])}-${String(ranges[0][1])}`);
  }

  // Middle ranges
  for (let i = 1; i < ranges.length - 1; i++) {
    const range = ranges[i];
    if (range.length === 1) {
      labels.push(String(range[0]));
    } else {
      labels.push(`${String(range[0])}-${String(range[1])}`);
    }
  }

  // Last range (if more than one range)
  if (ranges.length > 1) {
    const last = ranges[ranges.length - 1];
    if (last.length === 1) {
      labels.push(`>=${String(last[0])}`);
    } else {
      labels.push(`${String(last[0])}-${String(last[1])}`);
    }
  }

  return labels;
}

/**
 * Determine which year group a value belongs to
 */
export function getYearGroupForValue(
  value: number,
  ranges: number[][],
  yearGroups: string[]
): string | null {
  if (ranges.length === 0 || yearGroups.length === 0) return null;

  for (const group of yearGroups) {
    if (group.includes("-")) {
      const [startYear, endYear] = group.split("-").map(Number);
      if (value >= startYear && value <= endYear) {
        return group;
      }
    } else if (group.startsWith("<=")) {
      const year = Number(group.replace("<=", ""));
      if (value <= year) {
        return group;
      }
    } else if (group.startsWith(">=")) {
      const year = Number(group.replace(">=", ""));
      if (value >= year) {
        return group;
      }
    } else {
      const year = Number(group);
      if (value === year) {
        return group;
      }
    }
  }

  return null;
}

/**
 * Count unique groups in auto_groups array
 */
export function countUniqueGroups(autoGroups: AutoGroupItem[]): number {
  const uniqueGroups = new Set(autoGroups.map((item) => item.group));
  return uniqueGroups.size;
}

/**
 * Get all unique group names from auto_groups array
 */
export function getUniqueGroupNames(autoGroups: AutoGroupItem[]): string[] {
  const uniqueGroups = new Set(autoGroups.map((item) => item.group));
  return Array.from(uniqueGroups);
}

/**
 * Where the Group Names dropdown's names come from, for its empty state: the
 * value of the chosen metadata on each grid feature's genome (or, for
 * Collection Year with Year Ranges set, the range the year falls in).
 */
export function groupNamesSourceText(
  metadataGroup: string | undefined,
): string {
  const label =
    metadataOptions.find((option) => option.value === metadataGroup)?.label ??
    "metadata";
  const yearRange =
    metadataGroup === "collection_year"
      ? " (or its year range, when Year Ranges are set)"
      : "";
  return `Group names come from the Groups Grid, where each added feature is grouped by its genome's ${label}${yearRange}.`;
}

/**
 * Transform MetaCATS form data to API parameters
 */
export function transformMetaCatsParams(
  data: MetaCatsFormData
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    p_value: data.p_value,
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    input_type: data.input_type,
  };

  // Set alphabet based on input type
  if (data.input_type === "auto") {
    params.alphabet = data.auto_alphabet === "aa" ? "aa" : "na";
    params.metadata_group = data.metadata_group;

    // Add year ranges if collection_year is selected
    if (data.metadata_group === "collection_year" && data.year_ranges) {
      params.year_ranges = data.year_ranges;
    }

    // Transform auto_groups to API format
    if (data.auto_groups && data.auto_groups.length > 0) {
      params.auto_groups = data.auto_groups.map((item) => ({
        id: item.patric_id,
        metadata: item.metadata,
        grp: item.group,
        g_id: item.genome_id,
      }));
    }
  } else if (data.input_type === "groups") {
    params.alphabet = data.group_alphabet === "aa" ? "aa" : "na";
    params.groups = data.groups;
  } else {
    // data.input_type === "files"
    params.alignment_file = data.alignment_file;
    params.group_file = data.group_file;

    // Determine alphabet from alignment file type
    if (data.alignment_type?.includes("protein")) {
      params.alphabet = "aa";
    } else {
      params.alphabet = "na";
    }
  }

  return params;
}

/**
 * Validate year ranges format
 */
export function validateYearRanges(yearRanges: string): {
  valid: boolean;
  message: string;
} {
  if (!yearRanges || yearRanges.trim() === "") {
    return { valid: true, message: "" };
  }

  const pattern = /^[\s\-,0-9]*$/;
  if (!pattern.test(yearRanges)) {
    return {
      valid: false,
      message: "Invalid year range format. Use: 1998,1999-2005,2006",
    };
  }

  const ranges = parseYearRanges(yearRanges);
  if (ranges.length === 0) {
    return { valid: false, message: "No valid year ranges found" };
  }

  return { valid: true, message: `${String(ranges.length)} range(s) parsed successfully` };
}

function createMetaCatsRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${String(Date.now())}-${Math.random().toString(16).slice(2)}`;
}

export function createGenomeIdMapFromFeatures(
  features: MetaCatsFeatureLike[],
): Map<string, string[]> {
  const genomeIdMap = new Map<string, string[]>();

  features.forEach((feature) => {
    if (feature.genome_id && feature.patric_id) {
      const current = genomeIdMap.get(feature.genome_id) ?? [];
      current.push(feature.patric_id);
      genomeIdMap.set(feature.genome_id, current);
    }
  });

  return genomeIdMap;
}

/** A genome's GenBank accessions as one string (Solr may return a list). */
function genbankAccessions(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return "";
}

export function buildMetaCatsAutoGroupsFromGenomes(args: {
  genomes: MetaCatsGenomeLike[];
  genomeIdMap: Map<string, string[]>;
  metadataGroup: string;
  yearRanges?: string;
  existingAutoGroups: AutoGroupItem[];
  existingGroupNames: string[];
  createId?: () => string;
}): { newAutoGroups: AutoGroupItem[]; nextGroupNames: string[] } {
  const {
    genomes,
    genomeIdMap,
    metadataGroup,
    yearRanges,
    existingAutoGroups,
    existingGroupNames,
    createId = createMetaCatsRowId,
  } = args;

  let parsedRanges: number[][] = [];
  let yearGroupLabels: string[] = [];
  if (metadataGroup === "collection_year" && yearRanges) {
    parsedRanges = parseYearRanges(yearRanges);
    yearGroupLabels = getYearGroupLabels(parsedRanges);
  }

  const newAutoGroups: AutoGroupItem[] = [];
  const nextGroupNames = new Set<string>(existingGroupNames);
  const existingPatricIds = new Set(existingAutoGroups.map((ag) => ag.patric_id));

  genomes.forEach((genome) => {
    const metadataValue = genome[metadataGroup];
    const metadataStr = metadataValue !== undefined && metadataValue !== null
      ? (typeof metadataValue === 'string' ? metadataValue : (typeof metadataValue === 'number' || typeof metadataValue === 'boolean' ? String(metadataValue) : JSON.stringify(metadataValue)))
      : "";

    let groupValue = metadataStr;
    if (metadataGroup === "collection_year" && parsedRanges.length > 0) {
      const yearValue = Number(metadataValue);
      if (!isNaN(yearValue)) {
        const yearGroup = getYearGroupForValue(yearValue, parsedRanges, yearGroupLabels);
        groupValue = yearGroup || metadataStr;
      }
    }

    nextGroupNames.add(groupValue);

    const featureIds = genomeIdMap.get(genome.genome_id) || [];
    featureIds.forEach((patricId) => {
      if (!existingPatricIds.has(patricId)) {
        newAutoGroups.push({
          id: createId(),
          patric_id: patricId,
          metadata: metadataStr,
          group: groupValue,
          genome_id: genome.genome_id,
          genbank_accessions: genbankAccessions(genome.genbank_accessions),
          strain: typeof genome.strain === "string" ? genome.strain : "",
        });
        existingPatricIds.add(patricId);
      }
    });
  });

  return { newAutoGroups, nextGroupNames: Array.from(nextGroupNames) };
}

export function removeAutoGroupsByRowIds(
  autoGroups: AutoGroupItem[],
  selectedRowIds: Set<string>,
): AutoGroupItem[] {
  if (selectedRowIds.size === 0) return autoGroups;
  return autoGroups.filter((item) => !selectedRowIds.has(item.id));
}

export function updateAutoGroupsGroupByRowIds(
  autoGroups: AutoGroupItem[],
  selectedRowIds: Set<string>,
  groupName: string,
): AutoGroupItem[] {
  if (selectedRowIds.size === 0) return autoGroups;
  return autoGroups.map((item) =>
    selectedRowIds.has(item.id) ? { ...item, group: groupName } : item,
  );
}

/**
 * The grid selects rows by BRC ID (`patric_id`); the delete and change-group
 * helpers work on each row's own `id`.
 */
export function selectedAutoGroupRowIds(
  autoGroups: AutoGroupItem[],
  selection: RowSelectionState,
): Set<string> {
  return new Set(
    autoGroups
      .filter((item) => item.patric_id in selection)
      .map((item) => item.id),
  );
}

const naturalOrder = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * The Groups Grid sorts in the browser: it holds every row, and DataTable
 * leaves sorting to its owner. Numbers inside values compare numerically
 * (729.9 before 729.10), and empty values stay last in either direction.
 */
export function sortMetaCatsAutoGroups(
  autoGroups: AutoGroupItem[],
  sorting: SortingState,
): AutoGroupItem[] {
  if (sorting.length === 0) return autoGroups;
  const sort = sorting[0];
  const key = sort.id as keyof AutoGroupItem;
  const direction = sort.desc ? -1 : 1;
  return [...autoGroups].sort((a, b) => {
    const left = a[key] ?? "";
    const right = b[key] ?? "";
    if (left === "" || right === "") {
      return left === right ? 0 : left === "" ? 1 : -1;
    }
    return naturalOrder.compare(left, right) * direction;
  });
}
