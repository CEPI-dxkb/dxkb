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

/**
 * Client-facing text for a deployment with no Data API base URL. Stable and
 * distinct from a per-accession upstream failure, without echoing the
 * `DATA_API_URL`/`NEXT_PUBLIC_DATA_API` env var name — which
 * `createServerDataRepository`'s thrown error does name — to a response any
 * caller can read. Mirrors the equivalent client-facing message in
 * `src/app/api/data/[resource]/route.ts`.
 */
const proteinStructureNotConfiguredMessage =
  "The protein structure service is not configured for this deployment.";

export async function getProteinStructures(
  accessions: readonly string[],
): Promise<ProteinStructureLookup[]> {
  // Deliberately not wrapped in React `cache()`: this takes an array of
  // accessions, so memoizing on "same array" would not mean the same thing as
  // the scalar-ID memoization the sibling *-view/server.ts modules do.
  let repository: ServerDataRepository;
  try {
    repository = await createServerDataRepository();
  } catch (error) {
    // Narrow on the factory's specific "not configured" error only — a
    // readSession()/cookies() failure (or anything else) is a different
    // problem and must propagate normally, not be relabeled as a
    // configuration issue. The factory's error names the env var for
    // operators; log that detail server-side and return the generic message
    // above to callers instead.
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
