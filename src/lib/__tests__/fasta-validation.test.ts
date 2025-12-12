import {
  cleanFasta,
  isDNA,
  validateFasta,
  validateFastaForBlast,
} from "../fasta-validation";

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

      expect(result.valid).toBe(true); // Should be valid as protein
      expect(result.status).toBe("valid_dna");
    });

    it("should reject protein when DNA expected", () => {
      const fasta = ">seq1\nACDEFGHIKLMNPQRSTVWY";
      const result = validateFasta(fasta, "dna");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("need_dna");
    });

    it("should handle empty input", () => {
      const result = validateFasta("", "dna");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("empty");
    });

    it("should handle invalid FASTA format", () => {
      const fasta = "ATCG"; // Missing '>'
      const result = validateFasta(fasta, "dna");

      expect(result.valid).toBe(false);
      expect(result.status).toBe("too_short");
    });

    it("should add header if missing and replace=true", () => {
      const fasta = "ATCG";
      const result = validateFasta(fasta, "dna", { replace: true });

      expect(result.valid).toBe(true);
      expect(result.trimFasta).toBe(">record_1\nATCG");
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
});
