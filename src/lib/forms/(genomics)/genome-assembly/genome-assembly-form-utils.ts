import { GenomeAssemblyFormData } from "./genome-assembly-form-schema";

export const genomeAssemblyRecipes = [
  { value: "auto", label: "Auto" },
  { value: "unicycler", label: "Unicycler" },
  { value: "spades", label: "SPAdes" },
  { value: "canu", label: "Canu" },
  { value: "meta-spades", label: "metaSPAdes" },
  { value: "plasmid-spades", label: "plasmidSPAdes" },
  { value: "single-cell", label: "MDA (single-cell)" },
  { value: "flye", label: "Flye" },
  { value: "megahit", label: "MegaHit" },
];

export const genomeSizeUnitOptions = [
  { value: "M", label: "M" },
  { value: "K", label: "K" },
];

/**
 * Transform genome assembly form data to the format expected by the backend service
 */
export function transformGenomeAssemblyParams(data: GenomeAssemblyFormData) {
  const params: Record<string, any> = {
    recipe: data.recipe,
    output_path: data.output_path,
    output_file: data.output_file,
  };

  // Add library data
  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => {
      const libData: Record<string, any> = {};

      // Copy all properties except internal ones (starting with _)
      Object.keys(lib).forEach((key) => {
        if (!key.startsWith("_")) {
          libData[key] = lib[key as keyof typeof lib];
        }
      });

      return libData;
    });
  }

  if (data.single_end_libs && data.single_end_libs.length > 0) {
    params.single_end_libs = data.single_end_libs.map((lib) => {
      const libData: Record<string, any> = {};

      Object.keys(lib).forEach((key) => {
        if (!key.startsWith("_")) {
          libData[key] = lib[key as keyof typeof lib];
        }
      });

      return libData;
    });
  }

  if (data.srr_ids && data.srr_ids.length > 0) {
    params.srr_ids = data.srr_ids;
  }

  // Add genome size if provided (required for Canu)
  if (data.genome_size !== undefined && data.genome_size > 0) {
    params.genome_size = data.genome_size;
  }

  // Add advanced parameters if they are explicitly set
  if (data.trim !== undefined) {
    params.trim = data.trim;
  }

  if (data.normalize !== undefined) {
    params.normalize = data.normalize;
  }

  if (data.filtlong !== undefined) {
    params.filtlong = data.filtlong;
  }

  if (data.target_depth !== undefined) {
    params.target_depth = data.target_depth;
  }

  if (data.racon_iter !== undefined) {
    params.racon_iter = data.racon_iter;
  }

  if (data.pilon_iter !== undefined) {
    params.pilon_iter = data.pilon_iter;
  }

  if (data.min_contig_len !== undefined) {
    params.min_contig_len = data.min_contig_len;
  }

  if (data.min_contig_cov !== undefined) {
    params.min_contig_cov = data.min_contig_cov;
  }

  return params;
}

/**
 * Calculate genome size based on expected size and unit
 */
export function calculateGenomeSize(
  expectedGenomeSize: number,
  genomeSizeUnit: "M" | "K",
): number {
  const multiplier = genomeSizeUnit === "M" ? 1000000 : 1000;
  return expectedGenomeSize * multiplier;
}
