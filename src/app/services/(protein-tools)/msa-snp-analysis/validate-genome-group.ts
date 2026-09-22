import {
  getGenomeIdsFromGroup,
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
  // Read the group's id list directly: fetchGenomeGroupMembers() resolves
  // metadata through /api/services/genome/by-ids, which caps the query at 100
  // rows, so groups of 101+ genomes reported a truncated count and skipped
  // validation for every genome past the first 100.
  const genomeIds = await getGenomeIdsFromGroup(path);
  if (genomeIds.length === 0) return { status: "empty" };
  if (genomeIds.length > maxGenomes) {
    return { status: "too-large", genomeCount: genomeIds.length };
  }

  const validation = await validateViralGenomes(genomeIds, { maxGenomeLength });
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

  return { status: "valid", genomeCount: genomeIds.length };
}
