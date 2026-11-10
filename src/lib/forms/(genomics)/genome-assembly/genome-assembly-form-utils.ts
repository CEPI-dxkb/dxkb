import { GenomeAssemblyFormData } from "./genome-assembly-form-schema";
import { rerunBooleanValue } from "@/lib/rerun-utility";

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

export function transformGenomeAssemblyParams(data: GenomeAssemblyFormData) {
  const params: Record<string, unknown> = {
    recipe: data.recipe,
    output_path: data.output_path,
    output_file: data.output_file,
  };

  if (data.paired_end_libs && data.paired_end_libs.length > 0) {
    params.paired_end_libs = data.paired_end_libs.map((lib) => {
      const libData: Record<string, unknown> = {};

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
      const libData: Record<string, unknown> = {};

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

  if (data.genome_size !== undefined && data.genome_size > 0) {
    params.genome_size = data.genome_size;
  }

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

export function calculateGenomeSize(
  expectedGenomeSize: number,
  genomeSizeUnit: "M" | "K",
): number {
  const multiplier = genomeSizeUnit === "M" ? 1000000 : 1000;
  return expectedGenomeSize * multiplier;
}

export interface GenomeSizeDisplay {
  count: number;
  unit: "M" | "K";
}

/** Whole megabases show in M, anything else in K, rounded to the nearest whole kilobase. */
export function genomeSizeDisplay(bases: number): GenomeSizeDisplay {
  if (bases % 1000000 === 0) return { count: bases / 1000000, unit: "M" };
  return { count: Math.round(bases / 1000), unit: "K" };
}

const rerunAdvancedNumberFields = [
  "target_depth",
  "racon_iter",
  "pilon_iter",
  "min_contig_len",
  "min_contig_cov",
] as const;

const rerunAdvancedBooleanFields = ["trim", "normalize", "filtlong"] as const;

function rerunNumber(value: unknown): number | undefined {
  // Number("") and Number("  ") are 0, not unset.
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * The Advanced Options a job ran with, as form values.
 * `values.genome_size` keeps the job's exact bases so a non-whole-kilobase size resubmits unchanged.
 */
export function rerunGenomeAssemblyAdvancedOptions(
  data: Record<string, unknown>,
): {
  values: Partial<GenomeAssemblyFormData>;
  genomeSize?: GenomeSizeDisplay;
} {
  const values: Partial<GenomeAssemblyFormData> = {};
  for (const field of rerunAdvancedNumberFields) {
    const value = rerunNumber(data[field]);
    if (value !== undefined) values[field] = value;
  }
  for (const field of rerunAdvancedBooleanFields) {
    if (data[field] != null) values[field] = rerunBooleanValue(data[field]);
  }
  const bases = rerunNumber(data.genome_size);
  if (bases === undefined || bases <= 0) return { values };
  values.genome_size = bases;
  return { values, genomeSize: genomeSizeDisplay(bases) };
}
