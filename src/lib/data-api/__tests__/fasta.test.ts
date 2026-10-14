import {
  fastaFileName,
  isFastaResource,
  maxFastaIds,
  supportsFastaType,
} from "../fasta";
import { DataApiValidationError } from "../resources";
import { maxRqlInValues } from "../rql";
import { validateFastaRequest } from "../validation";

describe("FASTA capabilities", () => {
  it("serves features and contigs, and nothing else", () => {
    expect(isFastaResource("genome_feature")).toBe(true);
    expect(isFastaResource("genome_sequence")).toBe(true);
    expect(isFastaResource("genome")).toBe(false);
    expect(isFastaResource("ppi")).toBe(false);
    // A prototype key must not pass as a resource.
    expect(isFastaResource("toString")).toBe(false);
  });

  it("offers no protein translation of a contig", () => {
    expect(supportsFastaType("genome_feature", "dna")).toBe(true);
    expect(supportsFastaType("genome_feature", "protein")).toBe(true);
    expect(supportsFastaType("genome_sequence", "dna")).toBe(true);
    expect(supportsFastaType("genome_sequence", "protein")).toBe(false);
  });

  it("keeps the per-request id cap equal to the upstream in() ceiling", () => {
    expect(maxFastaIds).toBe(maxRqlInValues);
  });
});

describe("fastaFileName", () => {
  it("replaces the pipe in a BRC ID and appends the sequence type", () => {
    expect(fastaFileName("fig|644340.17.peg.16", "dna")).toBe(
      "fig_644340.17.peg.16.dna.fasta",
    );
    expect(fastaFileName("fig|644340.17.peg.16", "protein")).toBe(
      "fig_644340.17.peg.16.protein.fasta",
    );
  });

  it("strips path separators, reserved characters, control characters and leading dots", () => {
    expect(fastaFileName('../a/b\\c:d*e?f"g<h>i\u0007j', "dna")).toBe(
      "_a_b_c_d_e_f_g_h_i_j.dna.fasta",
    );
  });

  it("falls back to a generic base when nothing usable is left", () => {
    expect(fastaFileName("  ", "dna")).toBe("sequences.dna.fasta");
    expect(fastaFileName("...", "protein")).toBe("sequences.protein.fasta");
  });

  it("bounds the base length", () => {
    expect(fastaFileName("x".repeat(500), "dna")).toBe(
      `${"x".repeat(200)}.dna.fasta`,
    );
  });
});

describe("validateFastaRequest", () => {
  it("accepts a supported type and drops duplicate ids", () => {
    expect(
      validateFastaRequest("genome_feature", {
        type: "protein",
        ids: ["PATRIC.1", "PATRIC.2", "PATRIC.1"],
      }),
    ).toEqual({ type: "protein", ids: ["PATRIC.1", "PATRIC.2"] });
  });

  it("rejects a type the resource cannot serve", () => {
    expect(() =>
      validateFastaRequest("genome_sequence", {
        type: "protein",
        ids: ["1.1.con.0001"],
      }),
    ).toThrow(
      new DataApiValidationError(
        "Protein FASTA is not available for genome_sequence.",
      ),
    );
  });

  it("rejects an unknown type", () => {
    expect(() =>
      validateFastaRequest("genome_feature", { type: "rna", ids: ["a"] }),
    ).toThrow(DataApiValidationError);
  });

  it("rejects an empty id list with a message a person can act on", () => {
    expect(() =>
      validateFastaRequest("genome_feature", { type: "dna", ids: [] }),
    ).toThrow("Choose at least one record to download.");
  });

  it("rejects more ids than one upstream in() clause can carry", () => {
    expect(() =>
      validateFastaRequest("genome_feature", {
        type: "dna",
        ids: Array.from({ length: maxFastaIds + 1 }, (_, index) =>
          String(index),
        ),
      }),
    ).toThrow("FASTA downloads are limited to 500 records per request.");
  });

  it("rejects empty and non-string ids", () => {
    expect(() =>
      validateFastaRequest("genome_feature", { type: "dna", ids: [""] }),
    ).toThrow(DataApiValidationError);
    expect(() =>
      validateFastaRequest("genome_feature", { type: "dna", ids: [1] }),
    ).toThrow(DataApiValidationError);
    expect(() => validateFastaRequest("genome_feature", null)).toThrow(
      DataApiValidationError,
    );
  });
});
