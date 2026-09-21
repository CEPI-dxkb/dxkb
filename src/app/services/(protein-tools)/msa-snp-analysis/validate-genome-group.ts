import {
  fetchGenomeGroupMembers,
  validateViralGenomes,
} from "@/lib/services/genome";

export type GenomeGroupValidationResult =
  | { status: "valid"; genomeCount: number }
  | { status: "empty" }
  | { status: "too-large"; genomeCount: number }
  | { status: "invalid"; message: string };

interface ValidateGenomeGroupOptions {
  maxGenomes: number;
  maxGenomeLength: number;
}

export async function validateGenomeGroup(
  path: string,
  { maxGenomes, maxGenomeLength }: ValidateGenomeGroupOptions,
): Promise<GenomeGroupValidationResult> {
  const genomes = await fetchGenomeGroupMembers(path);
  if (genomes.length === 0) return { status: "empty" };
  if (genomes.length > maxGenomes) {
    return { status: "too-large", genomeCount: genomes.length };
  }

  const validation = await validateViralGenomes(
    genomes.map((genome) => genome.genome_id),
    { maxGenomeLength },
  );
  if (!validation.allValid) {
    const errors = Object.values(validation.errors).filter(Boolean);
    return {
      status: "invalid",
      message:
        errors.length > 0
          ? errors.join("\n")
          : "Invalid genome group. Please check that all genomes are viruses with single contigs.",
    };
  }

  return { status: "valid", genomeCount: genomes.length };
}
