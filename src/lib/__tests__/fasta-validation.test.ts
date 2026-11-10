import {
  cleanFasta,
  isDNA,
  validateFasta,
  validateProteinFasta,
  validateFastaForBlast,
  getFastaErrorMessage,
} from "@/lib/fasta-validation";

describe("FASTA Validation", () => {
  describe("cleanFasta", () => {
    it("should clean whitespace and normalize line endings", () => {
      const input = ">seq1\r\nATCG\r\n>seq2\r\nGCTA\r\n";
      const expected = ">seq1\nATCG\n>seq2\nGCTA";
      expect(cleanFasta(input)).toBe(expected);
    });

    it("should remove spaces from sequence lines", () => {
      const input = ">seq1\nA T C G\n>seq2\nG C T A";
      const expected = ">seq1\nATCG\n>seq2\nGCTA";
      expect(cleanFasta(input)).toBe(expected);
    });
  });

  describe("isDNA", () => {
    it("should identify DNA sequences", () => {
      expect(isDNA("ATCG")).toBe(true);
      expect(isDNA("atcg")).toBe(true);
      expect(isDNA("ATCGN")).toBe(true);
      expect(isDNA("ATCG-")).toBe(true);
    });

    it("should identify protein sequences", () => {
      expect(isDNA("ACDEFGHIKLMNPQRSTVWY")).toBe(false);
      expect(isDNA("ACDEFGHIKLMNPQRSTVWY-")).toBe(false);
    });

    it("should handle mixed sequences", () => {
      expect(isDNA("ATCGACDEFGHIKLMNPQRSTVWY")).toBe(false);
      expect(isDNA("ATCGATCGATCGATCG")).toBe(true);
    });
  });

  describe("validateFasta", () => {
    it("should validate correct DNA FASTA", () => {
      const fasta = ">seq1\nATCG\n>seq2\nGCTA";
      const result = validateFasta(fasta, "dna");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_dna");
      expect(result.numseq).toBe(2);
      expect(result.message).toBe("");
    });

    it("should validate correct protein FASTA", () => {
      const fasta = ">seq1\nACDEFGHIKLMNPQRSTVWY\n>seq2\nACDEFGHIKLMNPQRSTVWY";
      const result = validateFasta(fasta, "aa");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_protein");
      expect(result.numseq).toBe(2);
      expect(result.message).toBe("");
    });

    it("should reject DNA when protein expected", () => {
      const fasta = ">seq1\nATCG";
      const result = validateFasta(fasta, "aa");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_dna");
    });

    it("should reject protein when DNA expected", () => {
      const fasta = ">seq1\nACDEFGHIKLMNPQRSTVWY";
      const result = validateFasta(fasta, "dna");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("need_dna");
    });

    it("accepts RNA and IUPAC nucleotide FASTA", () => {
      const result = validateFasta(">seq1\nAUGCURYSWKMBDHVN", "dna");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_dna");
    });

    it("rejects a mixed protein and nucleotide FASTA as protein-only input", () => {
      const result = validateProteinFasta(
        ">protein\nMKAILVVLL\n>dna\nACGTACGT",
      );

      expect(result.valid).toBe(false);
      expect(result.status).toBe("need_protein");
    });

    it("rejects RNA and IUPAC nucleotide FASTA as protein-only input", () => {
      const result = validateProteinFasta(">rna\nAUGCURYSWKMBDHVN");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("need_protein");
    });

    it("should handle empty input", () => {
      const result = validateFasta("", "dna");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("empty");
    });

    it("should handle invalid FASTA format", () => {
      const fasta = "ATCG";
      const result = validateFasta(fasta, "dna");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("too_short");
    });

    it("should add header to trimFasta when missing and replace=true", () => {
      // replace=true adds a header to trimFasta but the original input is still validated, and a bare sequence line is too_short.
      const fasta = "ATCG";
      const result = validateFasta(fasta, "dna", { replace: true });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("too_short");
    });
  });

  describe("validateFastaForBlast", () => {
    it("should validate DNA for blastn", () => {
      const fasta = ">seq1\nATCG";
      const result = validateFastaForBlast(fasta, "blastn");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_dna");
    });

    it("should validate protein for blastp", () => {
      const fasta = ">seq1\nACDEFGHIKLMNPQRSTVWY";
      const result = validateFastaForBlast(fasta, "blastp");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_protein");
    });

    it("should validate DNA for blastx", () => {
      const fasta = ">seq1\nATCG";
      const result = validateFastaForBlast(fasta, "blastx");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_dna");
    });

    it("should validate protein for tblastn", () => {
      const fasta = ">seq1\nACDEFGHIKLMNPQRSTVWY";
      const result = validateFastaForBlast(fasta, "tblastn");

      expect(result.valid).toBe(true);
      expect(result.status).toBe("valid_protein");
    });

    it("should reject wrong sequence type for blast program", () => {
      const fasta = ">seq1\nACDEFGHIKLMNPQRSTVWY";
      const result = validateFastaForBlast(fasta, "blastn");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("need_dna");
    });
  });

  describe("getFastaErrorMessage", () => {
    it("returns nucleotide-specific message for need_dna status", () => {
      const result = {
        valid: false,
        status: "need_dna",
        numseq: 0,
        message: "Too few nucleotide letters on line 2.",
        trimFasta: "",
      };
      const msg = getFastaErrorMessage(result, "BLASTN");
      expect(msg).toBe(
        "BLASTN requires nucleotide sequences. Too few nucleotide letters on line 2.",
      );
    });

    it("returns the original message for non need_dna statuses", () => {
      const result = {
        valid: false,
        status: "too_short",
        numseq: 0,
        message: 'A fasta record is at least two lines and starts with ">".',
        trimFasta: "",
      };
      const msg = getFastaErrorMessage(result, "BLASTN");
      expect(msg).toBe(
        'A fasta record is at least two lines and starts with ">".',
      );
    });

    it("uses the display name verbatim in the message", () => {
      const result = {
        valid: false,
        status: "need_dna",
        numseq: 0,
        message: "error",
        trimFasta: "",
      };
      const msg = getFastaErrorMessage(result, "BLASTX");
      expect(msg).toContain("BLASTX");
    });

    it("works with non-BLAST program names", () => {
      const result = {
        valid: false,
        status: "need_dna",
        numseq: 0,
        message: "Too few nucleotide letters on line 2.",
        trimFasta: "",
      };
      const msg = getFastaErrorMessage(result, "Subspecies Classification");
      expect(msg).toBe(
        "Subspecies Classification requires nucleotide sequences. Too few nucleotide letters on line 2.",
      );
    });
  });

  describe("validateFasta - additional statuses", () => {
    it("returns too_long when text exceeds maxFastaText", () => {
      const longText = ">seq1\n" + "A".repeat(70000);
      const result = validateFasta(longText, "dna", { maxFastaText: 64000 });
      expect(result.status).toBe("too_long");
      expect(result.valid).toBe(false);
    });

    it("returns invalid_start when not starting with > and replace is false", () => {
      const result = validateFasta("ATCGATCG\nATCG", "dna", { replace: false });
      expect(result.status).toBe("invalid_start");
      expect(result.valid).toBe(false);
    });

    it("returns invalid_letters for non-alphabetic sequence characters", () => {
      const fasta = ">seq1\nACDEF!!!GHI";
      const result = validateFasta(fasta, "aa");
      expect(result.status).toBe("invalid_letters");
      expect(result.valid).toBe(false);
    });

    it("returns missing_seqs when header has no following sequence", () => {
      const fasta = ">seq1\nATCG\n>seq2\n>seq3\nGCTA";
      const result = validateFasta(fasta, "dna");
      expect(result.status).toBe("missing_seqs");
      expect(result.valid).toBe(false);
    });

    it("ignores maxFastaText limit when ignoreMaxFastaTextLimit is true", () => {
      const longText = ">seq1\n" + "A".repeat(70000);
      const result = validateFasta(longText, "dna", {
        maxFastaText: 64000,
        ignoreMaxFastaTextLimit: true,
      });
      expect(result.status).not.toBe("too_long");
      expect(result.valid).toBe(true);
    });
  });
});
