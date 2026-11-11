import { validateFasta } from "@/lib/fasta-validation";
import {
  minSequences,
  type FastaFileItem,
} from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-schema";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";
import type { PickRejection } from "./use-pick-check";

export const fastaFileCheckBytes = 10 * 1024 * 1024;

function completeLines(text: string): string {
  const lines = text.split("\n");
  lines.pop();
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
  if (lines[lines.length - 1]?.startsWith(">")) lines.pop();
  return lines.join("\n");
}

/** Legacy MSA's check of a picked file. A `truncated` text only checks its complete records and cannot prove a count below the minimum. */
export function fastaFileProblem(
  text: string,
  { protein, truncated }: { protein: boolean; truncated: boolean },
): string | null {
  let checked = text;
  if (truncated) {
    checked = completeLines(text);
    if (!checked.trim()) {
      if (/^\s*>/.test(text)) return null;
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
