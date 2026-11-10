import type {
  ProteomeComparisonFormData,
  ComparisonItem,
  ComparisonItemType,
} from "./proteome-comparison-form-schema";

export function createComparisonItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${String(Date.now())}-${Math.random().toString(16).slice(2)}`;
}

export function getProteomeComparisonDisplayName(name: string, maxLength = 36): string {
  if (name.length <= maxLength) return name;
  const half = Math.floor(maxLength / 2) - 2;
  return `${name.slice(0, half)}...${name.slice(name.length - half)}`;
}

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

export function createFastaComparisonItem(path: string): ComparisonItem {
  const name = path.split("/").pop() || path;
  return {
    id: createComparisonItemId(),
    name,
    path,
    type: "fasta",
  };
}

export function createFeatureGroupComparisonItem(path: string): ComparisonItem {
  const name = path.split("/").pop() || path;
  return {
    id: createComparisonItemId(),
    name,
    path,
    type: "feature_group",
  };
}

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

export function isDuplicateComparisonItem(
  items: ComparisonItem[],
  newItem: Partial<ComparisonItem>
): boolean {
  return items.some((item) => {
    if (newItem.genome_id && item.genome_id === newItem.genome_id) {
      return true;
    }
    if (newItem.path && item.path === newItem.path && item.type === newItem.type) {
      return true;
    }
    return false;
  });
}

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

export function transformProteomeComparisonParams(
  data: ProteomeComparisonFormData
): Record<string, unknown> {
  const genomeIds: string[] = [];
  const userGenomes: string[] = [];
  const featureGroups: string[] = [];
  let referenceGenomeIndex = 0;

  if (data.ref_source_type === "genome" && data.ref_genome_id) {
    genomeIds.push(data.ref_genome_id);
    referenceGenomeIndex = 1;
  } else if (data.ref_source_type === "fasta" && data.ref_fasta_file) {
    userGenomes.push(data.ref_fasta_file);
    referenceGenomeIndex = -1;
  } else if (data.ref_source_type === "feature_group" && data.ref_feature_group) {
    featureGroups.push(data.ref_feature_group);
    referenceGenomeIndex = -2;
  }

  data.comparison_items.forEach((item) => {
    switch (item.type) {
      case "genome":
        if (item.genome_id) {
          genomeIds.push(item.genome_id);
        }
        break;
      case "genome_group":
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

  // reference_genome_index is 1-based over [genome_ids, user_genomes, user_feature_groups].
  if (referenceGenomeIndex === -1) {
    referenceGenomeIndex = genomeIds.length + 1;
  } else if (referenceGenomeIndex === -2) {
    referenceGenomeIndex = genomeIds.length + userGenomes.length + 1;
  }

  const params: Record<string, unknown> = {
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    genome_ids: genomeIds,
    reference_genome_index: referenceGenomeIndex,
  };

  if (userGenomes.length > 0) {
    params.user_genomes = userGenomes;
  }

  if (featureGroups.length > 0) {
    params.user_feature_groups = featureGroups;
  }

  params.min_seq_cov = data.min_seq_cov / 100;

  if (data.max_e_val.trim()) {
    params.max_e_val = data.max_e_val.trim();
  }

  params.min_ident = data.min_ident / 100;

  return params;
}

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
      message: `Adding this genome group would exceed the maximum of ${String(maxGenomes)} genomes. Current: ${String(currentCount)}, Group size: ${String(newGenomeIds.length)}`,
    };
  }

  return { valid: true };
}

export function removeComparisonItemById(
  items: ComparisonItem[],
  itemId: string
): ComparisonItem[] {
  return items.filter((item) => item.id !== itemId);
}
