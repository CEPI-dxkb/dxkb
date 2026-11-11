import {
  formatInvalidGenomeGroupMessage,
  getGenomeIdsFromGroup,
  validateViralGenomes,
} from "@/lib/services/genome";

export type GenomeGroupValidationResult =
  | { status: "valid"; genomeCount: number }
  | { status: "empty" }
  | { status: "too-large"; genomeCount: number }
  | { status: "invalid"; message: string };

export function genomeGroupRejection(
  result: Exclude<GenomeGroupValidationResult, { status: "valid" }>,
  maxGenomes: number,
): { title: string; message: string } {
  switch (result.status) {
    case "empty":
      return {
        title: "Empty genome group",
        message: "The selected genome group is empty.",
      };
    case "too-large":
      return {
        title: "Genome group too large",
        message: `The genome group has ${String(result.genomeCount)} genomes, but the maximum is ${String(maxGenomes)}.`,
      };
    case "invalid":
      return { title: "Genome group validation failed", message: result.message };
  }
}

interface ValidateGenomeGroupOptions {
  maxGenomes: number;
  maxGenomeLength: number;
}

export async function validateGenomeGroup(
  path: string,
  { maxGenomes, maxGenomeLength }: ValidateGenomeGroupOptions,
): Promise<GenomeGroupValidationResult> {
  // Read the id list directly: fetchGenomeGroupMembers() goes through a by-ids route capped at 100 rows.
  const genomeIds = await getGenomeIdsFromGroup(path);
  if (genomeIds.length === 0) return { status: "empty" };
  if (genomeIds.length > maxGenomes) {
    return { status: "too-large", genomeCount: genomeIds.length };
  }

  const validation = await validateViralGenomes(genomeIds, { maxGenomeLength });
  if (!validation.allValid) {
    return {
      status: "invalid",
      message: formatInvalidGenomeGroupMessage(validation.errors),
    };
  }

  return { status: "valid", genomeCount: genomeIds.length };
}
