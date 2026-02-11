import type {
  ProteomeComparisonFormData,
  ComparisonItem,
  ComparisonItemType,
} from "./proteome-comparison-form-schema";

/**
 * Generate a unique ID for comparison items
 */
export function createComparisonItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Get display name for a path or genome (truncated if too long)
 */
export function getProteomeComparisonDisplayName(name: string, maxLength: number = 36): string {
  if (name.length <= maxLength) return name;
  const half = Math.floor(maxLength / 2) - 2;
  return `${name.slice(0, half)}...${name.slice(name.length - half)}`;
}

/**
 * Create a comparison item for a genome
 */
export function createGenomeComparisonItem(
  genomeId: string,
  genomeName: string
): ComparisonItem {
  return {
    id: createComparisonItemId(),
    name: genomeName,
    genome_id: genomeId,
    type: "genome",
  };
}

/**
 * Create a comparison item for a fasta file
 */
export function createFastaComparisonItem(path: string): ComparisonItem {
  const name = path.split("/").pop() || path;
  return {
    id: createComparisonItemId(),
    name,
    path,
    type: "fasta",
  };
}

/**
 * Create a comparison item for a feature group
 */
export function createFeatureGroupComparisonItem(path: string): ComparisonItem {
  const name = path.split("/").pop() || path;
  return {
    id: createComparisonItemId(),
    name,
    path,
    type: "feature_group",
  };
}

/**
 * Create a comparison item for a genome group
 */
export function createGenomeGroupComparisonItem(
  path: string,
  genomeIds: string[]
): ComparisonItem {
  const name = path.split("/").pop() || path;
  return {
    id: createComparisonItemId(),
    name,
    path,
    type: "genome_group",
    genome_ids: genomeIds,
  };
}

/**
 * Check if a comparison item is a duplicate
 */
export function isDuplicateComparisonItem(
  items: ComparisonItem[],
  newItem: Partial<ComparisonItem>
): boolean {
  return items.some((item) => {
    // Check by genome_id for genomes
    if (newItem.genome_id && item.genome_id === newItem.genome_id) {
      return true;
    }
    // Check by path for workspace objects
    if (newItem.path && item.path === newItem.path && item.type === newItem.type) {
      return true;
    }
    return false;
  });
}

/**
 * Get the type label for display
 */
export function getComparisonItemTypeLabel(type: ComparisonItemType): string {
  switch (type) {
    case "genome":
      return "Genome";
    case "fasta":
      return "Protein FASTA";
    case "feature_group":
      return "Feature Group";
    case "genome_group":
      return "Genome Group";
    default:
      return type;
  }
}

/**
 * Count total genomes including genome groups
 */
export function countTotalComparisonGenomes(items: ComparisonItem[]): number {
  let count = 0;
  items.forEach((item) => {
    if (item.type === "genome_group" && item.genome_ids) {
      count += item.genome_ids.length;
    } else {
      count += 1;
    }
  });
  return count;
}

/**
 * Transform ProteomeComparison form data to API parameters
 *
 * Based on legacy SeqComparison.js getValues():
 * - genome_ids: array of genome IDs (reference first if ref is a genome)
 * - user_genomes: array of fasta file paths
 * - user_feature_groups: array of feature group paths
 * - reference_genome_index: 1-based index of reference in combined list
 * - min_seq_cov: decimal (e.g., 0.3 for 30%)
 * - max_e_val: string (e.g., "1e-5")
 * - min_ident: decimal (e.g., 0.1 for 10%)
 */
export function transformProteomeComparisonParams(
  data: ProteomeComparisonFormData
): Record<string, unknown> {
  const genomeIds: string[] = [];
  const userGenomes: string[] = [];
  const featureGroups: string[] = [];
  let referenceGenomeIndex = 0;

  // Add reference genome first based on source type
  if (data.ref_source_type === "genome" && data.ref_genome_id) {
    genomeIds.push(data.ref_genome_id);
    referenceGenomeIndex = 1;
  } else if (data.ref_source_type === "fasta" && data.ref_fasta_file) {
    userGenomes.push(data.ref_fasta_file);
    // Reference index will be after all genome_ids
    referenceGenomeIndex = -1; // Will be calculated after processing comparison items
  } else if (data.ref_source_type === "feature_group" && data.ref_feature_group) {
    featureGroups.push(data.ref_feature_group);
    // Reference index will be after genome_ids and userGenomes
    referenceGenomeIndex = -2; // Will be calculated after processing comparison items
  }

  // Process comparison items
  data.comparison_items.forEach((item) => {
    switch (item.type) {
      case "genome":
        if (item.genome_id) {
          genomeIds.push(item.genome_id);
        }
        break;
      case "genome_group":
        // For genome groups, add all genome IDs from the group
        if (item.genome_ids && item.genome_ids.length > 0) {
          genomeIds.push(...item.genome_ids);
        }
        break;
      case "fasta":
        if (item.path) {
          userGenomes.push(item.path);
        }
        break;
      case "feature_group":
        if (item.path) {
          featureGroups.push(item.path);
        }
        break;
    }
  });

  // Calculate reference_genome_index based on reference type
  // The index is 1-based and refers to position in the combined order:
  // [genome_ids, user_genomes, user_feature_groups]
  if (referenceGenomeIndex === -1) {
    // Reference is a fasta file - it's the first in userGenomes
    referenceGenomeIndex = genomeIds.length + 1;
  } else if (referenceGenomeIndex === -2) {
    // Reference is a feature group - it's the first in featureGroups
    referenceGenomeIndex = genomeIds.length + userGenomes.length + 1;
  }

  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    genome_ids: genomeIds,
    reference_genome_index: referenceGenomeIndex,
  };

  // Add optional arrays only if they have items
  if (userGenomes.length > 0) {
    params.user_genomes = userGenomes;
  }

  if (featureGroups.length > 0) {
    params.user_feature_groups = featureGroups;
  }

  // Add advanced parameters (convert percentages to decimals)
  if (data.min_seq_cov !== undefined) {
    params.min_seq_cov = data.min_seq_cov / 100;
  }

  if (data.max_e_val) {
    params.max_e_val = data.max_e_val.trim();
  }

  if (data.min_ident !== undefined) {
    params.min_ident = data.min_ident / 100;
  }

  return params;
}

/**
 * Validate if adding a genome group would exceed the max limit
 */
export function validateGenomeGroupAddition(
  currentItems: ComparisonItem[],
  newGenomeIds: string[],
  maxGenomes: number
): { valid: boolean; message?: string } {
  const currentCount = countTotalComparisonGenomes(currentItems);
  const totalAfterAdd = currentCount + newGenomeIds.length;

  if (totalAfterAdd > maxGenomes) {
    return {
      valid: false,
      message: `Adding this genome group would exceed the maximum of ${maxGenomes} genomes. Current: ${currentCount}, Group size: ${newGenomeIds.length}`,
    };
  }

  return { valid: true };
}

/**
 * Remove comparison item by ID
 */
export function removeComparisonItemById(
  items: ComparisonItem[],
  itemId: string
): ComparisonItem[] {
  return items.filter((item) => item.id !== itemId);
}
