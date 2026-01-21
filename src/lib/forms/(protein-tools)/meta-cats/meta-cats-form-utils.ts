import type { MetaCatsFormData, AutoGroupItem } from "./meta-cats-form-schema";

export interface MetaCatsFeatureLike {
  genome_id?: string;
  patric_id?: string;
}

export interface MetaCatsGenomeLike extends Record<string, unknown> {
  genome_id: string;
  strain?: string;
}

/**
 * Get display name for a path (truncated if too long)
 */
export function getMetaCatsDisplayName(name: string, maxLength: number = 36): string {
  if (name.length <= maxLength) return name;
  const half = Math.floor(maxLength / 2) - 2;
  return `${name.slice(0, half)}...${name.slice(name.length - half)}`;
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
    labels.push(`<=${ranges[0][0]}`);
  } else {
    labels.push(`${ranges[0][0]}-${ranges[0][1]}`);
  }

  // Middle ranges
  for (let i = 1; i < ranges.length - 1; i++) {
    const range = ranges[i];
    if (range.length === 1) {
      labels.push(`${range[0]}`);
    } else {
      labels.push(`${range[0]}-${range[1]}`);
    }
  }

  // Last range (if more than one range)
  if (ranges.length > 1) {
    const last = ranges[ranges.length - 1];
    if (last.length === 1) {
      labels.push(`>=${last[0]}`);
    } else {
      labels.push(`${last[0]}-${last[1]}`);
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

  for (let i = 0; i < yearGroups.length; i++) {
    const group = yearGroups[i];
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
  } else if (data.input_type === "files") {
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

  return { valid: true, message: `${ranges.length} range(s) parsed successfully` };
}

function createMetaCatsRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    const metadataStr = metadataValue !== undefined ? String(metadataValue) : "";

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
          genbank_accessions: "",
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
