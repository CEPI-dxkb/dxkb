"use server";

import { requireAuthSession } from "@/lib/auth/server/route";
import { buildMinhashServicePayload } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-utils";
import type { SimilarGenomeFinderFormData } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-schema";
import {
  parseMinhashResultPayload,
  mergeGenomeResults,
  type SimilarGenomeFinderResultRow,
} from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-result-utils";
import {
  fetchMinhashGenomeDetails,
  MinhashConfigurationError,
  MinhashServiceError,
  searchMinhash,
} from "@/lib/services/minhash";
import { formatUserFacingErrorMessage } from "@/lib/utils";

export interface SubmitSimilarGenomesResult {
  success: true;
  rows: SimilarGenomeFinderResultRow[];
  genomeDetailsError?: string;
}

export interface SubmitSimilarGenomesError {
  success: false;
  error: string;
}

export type SubmitSimilarGenomesResponse =
  SubmitSimilarGenomesResult | SubmitSimilarGenomesError;

function getMinhashRowsAndIds(result: unknown): {
  minhashRows: SimilarGenomeFinderResultRow[];
  genomeIds: string[];
} {
  let minhashRows = parseMinhashResultPayload(result);
  let genomeIds = minhashRows.reduce<string[]>((ids, row) => {
    const genomeId = row.genome_id.trim();
    if (genomeId) ids.push(genomeId);
    return ids;
  }, []);

  if (
    minhashRows.length > 0 &&
    genomeIds.length === 0 &&
    result &&
    typeof result === "object"
  ) {
    const raw = result as Record<string, unknown>;
    const resObj = raw.result;
    if (resObj && typeof resObj === "object") {
      const r = resObj as Record<string, unknown>;
      const idList = (r.genome_id ?? r.genomeId ?? r.id ?? raw.genome_ids) as
        unknown[] | undefined;
      const ids = Array.isArray(idList)
        ? idList.reduce<string[]>((values, value) => {
            const id =
              typeof value === "string" || typeof value === "number"
                ? String(value).trim()
                : "";
            if (id) values.push(id);
            return values;
          }, [])
        : [];
      if (ids.length >= minhashRows.length) {
        genomeIds = ids.slice(0, minhashRows.length);
        minhashRows = minhashRows.map((row, i) => ({
          ...row,
          genome_id: genomeIds[i] ?? row.genome_id,
        }));
      }
    }
  }
  return { minhashRows, genomeIds };
}

/** Service and network failures keep their own message; a missing setting is logged by name and shown without it. */
function describeSearchFailure(error: unknown): string {
  if (error instanceof MinhashConfigurationError) {
    console.error(error.message);
    return error.userMessage;
  }
  if (!(error instanceof MinhashServiceError)) {
    console.error("Similar Genome Finder search failed:", error);
  }
  return formatUserFacingErrorMessage(error, "Similar Genome Finder search failed");
}

/** Returns the failure instead of throwing, since production redacts a thrown Server Action error. */
export async function submitSimilarGenomes(
  data: SimilarGenomeFinderFormData,
): Promise<SubmitSimilarGenomesResponse> {
  try {
    const { token } = await requireAuthSession();
    const minhashResult = await searchMinhash(
      buildMinhashServicePayload(data),
      token,
    );
    const { minhashRows, genomeIds } = getMinhashRowsAndIds(minhashResult);
    if (genomeIds.length === 0) return { success: true, rows: minhashRows };

    try {
      const genomes = await fetchMinhashGenomeDetails(genomeIds, token);
      return {
        success: true,
        rows:
          genomes.length > 0
            ? mergeGenomeResults(minhashRows, genomes)
            : minhashRows,
      };
    } catch (error) {
      return {
        success: true,
        rows: minhashRows,
        genomeDetailsError: describeSearchFailure(error),
      };
    }
  } catch (error) {
    return { success: false, error: describeSearchFailure(error) };
  }
}
