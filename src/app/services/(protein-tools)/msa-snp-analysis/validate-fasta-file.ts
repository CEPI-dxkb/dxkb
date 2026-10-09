import { validateFasta } from "@/lib/fasta-validation";
import {
  minSequences,
  type FastaFileItem,
} from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-schema";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";
import type { PickRejection } from "./use-pick-check";

/** The most of a file read to check it: the preview route's cap. */
export const fastaFileCheckBytes = 10 * 1024 * 1024;

/** The text without a last header line, whose sequence a cut left out. */
function withoutTrailingHeader(text: string): string {
  const lines = text.trimEnd().split("\n");
  if (lines[lines.length - 1]?.startsWith(">")) lines.pop();
  return lines.join("\n");
}

/**
 * What is wrong with a FASTA file's text, or null. Legacy MSA's check of a
 * picked file (`MSA.js` `validate`): valid records for the file's type, with
 * no size limit and no ">record_1" prefix added, and at least
 * `minSequences` of them. A `truncated` text is the file's start, so its
 * records are checked, but a count below the minimum proves nothing.
 */
export function fastaFileProblem(
  text: string,
  { protein, truncated }: { protein: boolean; truncated: boolean },
): string | null {
  const result = validateFasta(
    truncated ? withoutTrailingHeader(text) : text,
    protein ? "aa" : "dna",
    { replace: false, ignoreMaxFastaTextLimit: true },
  );
  if (!result.valid) {
    return result.status === "empty"
      ? "The FASTA file is empty."
      : result.message;
  }
  if (!truncated && result.numseq < minSequences) {
    return `At least ${String(minSequences)} sequence(s) are required.`;
  }
  return null;
}

/** Reads a picked FASTA file and checks it, for `usePickCheck`. */
export async function checkFastaFile(
  repository: WorkspaceRepository,
  file: FastaFileItem,
): Promise<PickRejection | null> {
  try {
    const { text, truncated } = await repository.readTextStart(
      file.file,
      fastaFileCheckBytes,
    );
    const problem = fastaFileProblem(text, {
      protein: file.type.endsWith("_protein_fasta"),
      truncated,
    });
    return problem ? { title: "Invalid FASTA file", message: problem } : null;
  } catch (error) {
    console.error("Failed to read FASTA file:", error);
    const message =
      error instanceof Error ? error.message : "Failed to read the FASTA file";
    return { title: "Could not read the FASTA file", message };
  }
}
