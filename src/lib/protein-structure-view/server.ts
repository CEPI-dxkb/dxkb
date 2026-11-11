import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { DataApiError, type ServerDataRepository } from "@/lib/data-api/repository";
import {
  proteinStructureViewRecordSchema,
  type ProteinStructureViewRecord,
} from "./schema";

export interface ProteinStructureLookup {
  accession: string;
  metadata: ProteinStructureViewRecord | null;
  error?: string;
}

/** Client-facing text for a deployment with no Data API base URL; it does not echo the env var name that `createServerDataRepository`'s error names. */
const proteinStructureNotConfiguredMessage =
  "The protein structure service is not configured for this deployment.";

export async function getProteinStructures(
  accessions: readonly string[],
): Promise<ProteinStructureLookup[]> {
  // Not wrapped in React `cache()`: it takes an array, unlike the scalar-ID sibling modules.
  let repository: ServerDataRepository;
  try {
    repository = await createServerDataRepository({ readScope: "member" });
  } catch (error) {
    // Narrow on the factory's "not configured" error only; anything else must propagate. Its message names the env var, so log it and return the generic message.
    if (!(error instanceof DataApiError) || error.code !== "not_configured")
      throw error;
    console.error("Protein structure lookup is not configured:", error);
    return accessions.map((accession) => ({
      accession,
      metadata: null,
      error: proteinStructureNotConfiguredMessage,
    }));
  }

  return Promise.all(
    accessions.map(async (accession): Promise<ProteinStructureLookup> => {
      try {
        const result = await repository.member("protein_structure", {
          operation: "member",
          id: accession,
        });
        return {
          accession,
          metadata: result.row
            ? proteinStructureViewRecordSchema.parse(result.row)
            : null,
        };
      } catch (error) {
        return {
          accession,
          metadata: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
