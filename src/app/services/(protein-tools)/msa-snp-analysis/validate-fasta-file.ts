import { validateFasta } from "@/lib/fasta-validation";
import {
  minSequences,
  type FastaFileItem,
} from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-schema";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";
import type { PickRejection } from "./use-pick-check";

/** The most of a file read to check it: the preview route's cap. */
export const fastaFileCheckBytes = 10 * 1024 * 1024;

/**
 * A file's start without what the cut may have left incomplete: the line it
 * ends inside (when no line end fits, the read stops mid-line), then a last
 * header, whose sequence it left out.
 */
function completeLines(text: string): string {
  const lines = text.split("\n");
  // After a cut at a line end this is the empty string past it.
  lines.pop();
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
  if (lines[lines.length - 1]?.startsWith(">")) lines.pop();
  return lines.join("\n");
}

/**
 * What is wrong with a FASTA file's text, or null. Legacy MSA's check of a
 * picked file (`MSA.js` `validate`): valid records for the file's type, with
 * no size limit and no ">record_1" prefix added, and at least
 * `minSequences` of them. A `truncated` text is the file's start, so its
 * complete records are checked, but a count below the minimum proves
 * nothing, and neither does a start with no complete record in it (a first
 * sequence on one line longer than the read), as long as it opens with a
 * header: one that does not is no FASTA file at all.
 */
export function fastaFileProblem(
  text: string,
  { protein, truncated }: { protein: boolean; truncated: boolean },
): string | null {
  let checked = text;
  if (truncated) {
    checked = completeLines(text);
    if (!checked.trim()) {
      if (/^\s*>/.test(text)) return null;
      // The whole start, so the check below names its missing header.
      checked = text;
    }
  }
  const result = validateFasta(
    checked,
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
