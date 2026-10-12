import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import {
  checkFastaFile,
  fastaFileCheckBytes,
  fastaFileProblem,
} from "../validate-fasta-file";

const whole = { protein: false, truncated: false };

describe("fastaFileProblem", () => {
  it("passes a file of two or more valid records", () => {
    expect(fastaFileProblem(">a\nACGT\n>b\nACGA\n", whole)).toBeNull();
    expect(
      fastaFileProblem(">p1\nMKVLQ\n>p2\nMKLVE\n", {
        protein: true,
        truncated: false,
      }),
    ).toBeNull();
  });

  it("needs two sequences in a whole file, as legacy does", () => {
    expect(fastaFileProblem(">a\nACGT\n", whole)).toBe(
      "At least 2 sequence(s) are required.",
    );
  });

  it("checks a DNA file's letters as nucleotides", () => {
    expect(fastaFileProblem(">a\nACGT\n>b\nMKVLQ\n", whole)).toBe(
      "Invalid nucleotide letters on line 4.",
    );
  });

  it("does not prefix a record name, so a file must start with a header", () => {
    expect(fastaFileProblem("ACGT\n>b\nACGA\n", whole)).toBe(
      'A fasta record is at least two lines and starts with ">".',
    );
  });

  it("names an empty file", () => {
    expect(fastaFileProblem("", whole)).toBe("The FASTA file is empty.");
  });

  it("checks the records of a file's start, but not their count", () => {
    const start = { protein: false, truncated: true };
    // A long first record: more may follow past the cut.
    expect(fastaFileProblem(">a\nACGT\nACGT\n", start)).toBeNull();
    // The cut left a header without its sequence.
    expect(fastaFileProblem(">a\nACGT\n>b\n", start)).toBeNull();
    expect(fastaFileProblem(">a\nACGT\n>b\nACXT\n", start)).toBe(
      "Invalid nucleotide letters on line 4.",
    );
  });

  it("finds nothing wrong in a start that holds no complete record", () => {
    const start = { protein: false, truncated: true };
    // A first sequence on one line longer than the read: only its header fits.
    expect(fastaFileProblem(">a\n", start)).toBeNull();
    // No line end fits, so the read stops inside the header.
    expect(fastaFileProblem(">a very long hea", start)).toBeNull();
    // Or inside the first sequence line, which is dropped with the header.
    expect(fastaFileProblem(">a\nACGTAC", start)).toBeNull();
    // A line the read ends inside is not checked, so its cut is no error.
    expect(fastaFileProblem(">a\nACGT\n>b\nAC", start)).toBeNull();
  });

  it("rejects a start with no complete line that does not open with a header", () => {
    const start = { protein: false, truncated: true };
    const noHeader = 'A fasta record is at least two lines and starts with ">".';
    // Sequence text with no line end in the read: nothing complete to check,
    // but the missing header already shows it is not FASTA.
    expect(fastaFileProblem("ACGTACGTAC", start)).toBe(noHeader);
    // The preview keeps a line end at the very start rather than cut to it.
    expect(fastaFileProblem("\nACGTACGTAC", start)).toBe(noHeader);
    // Leading blank lines before a header are still a header start.
    expect(fastaFileProblem("\n\n>a\nACGTAC", start)).toBeNull();
  });
});

describe("checkFastaFile", () => {
  function repositoryWith(content?: string) {
    return new InMemoryWorkspaceRepository({
      directories: {
        "/u@bvbrc/home": content
          ? [{ name: "seqs.fa", type: "feature_dna_fasta", content }]
          : [],
      },
    });
  }
  const file = {
    file: "/u@bvbrc/home/seqs.fa",
    type: "feature_dna_fasta" as const,
  };

  it("reads up to the preview route's cap and passes a good file", async () => {
    const repository = repositoryWith(">a\nACGT\n>b\nACGA\n");

    await expect(checkFastaFile(repository, file)).resolves.toBeNull();
    expect(repository.calls).toContainEqual({
      method: "readTextStart",
      path: file.file,
      maxBytes: fastaFileCheckBytes,
    });
  });

  it("rejects a bad file with the problem as its message", async () => {
    await expect(
      checkFastaFile(repositoryWith(">a\nACGT\n"), file),
    ).resolves.toEqual({
      title: "Invalid FASTA file",
      message: "At least 2 sequence(s) are required.",
    });
  });

  it("keeps the read error's message", async () => {
    await expect(checkFastaFile(repositoryWith(), file)).resolves.toEqual({
      title: "Could not read the FASTA file",
      message: "File not found: /u@bvbrc/home/seqs.fa",
    });
  });
});
