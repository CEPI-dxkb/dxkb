import {
  assignSampleIdToNewSraLibraries,
  deriveSampleIdFromLibrary,
  extractSampleIdFromPath,
  mapLibraryToSampleIdItem,
  mapSraLibraryToSampleIdItem,
} from "@/lib/forms/service-library-rules";
import type { Library } from "@/types/services";

describe("service-library-rules", () => {
  it("extracts sample IDs from workspace paths", () => {
    expect(extractSampleIdFromPath("/ws/user/sample_R1.fastq")).toBe(
      "sample_R1",
    );
    expect(extractSampleIdFromPath("", "fallback")).toBe("fallback");
  });

  it("derives sample IDs from the first library file", () => {
    const library: Library = {
      id: "lib-1",
      name: "reads",
      type: "single",
      files: ["/ws/user/S1.fq"],
    };

    expect(deriveSampleIdFromLibrary(library)).toBe("S1");
  });

  it("maps paired and single libraries to form items with sample IDs", () => {
    const paired: Library = {
      id: "paired-1",
      name: "paired",
      type: "paired",
      files: ["/ws/user/S1_R1.fq", "/ws/user/S1_R2.fq"],
      sampleId: " Explicit Sample ",
    };
    const single: Library = {
      id: "single-1",
      name: "single",
      type: "single",
      files: ["/ws/user/S2.fq"],
    };

    expect(mapLibraryToSampleIdItem(paired)).toMatchObject({
      _type: "paired",
      read1: "/ws/user/S1_R1.fq",
      read2: "/ws/user/S1_R2.fq",
      sample_id: "Explicit Sample",
    });
    expect(mapLibraryToSampleIdItem(single)).toMatchObject({
      _type: "single",
      read: "/ws/user/S2.fq",
      sample_id: "S2",
    });
  });

  it("preserves SRA titles while mapping sample IDs", () => {
    const library: Library = {
      id: "SRR123",
      name: "SRR123",
      type: "sra",
      sampleId: "SampleA",
      title: "Study title",
    };

    expect(mapSraLibraryToSampleIdItem(library)).toEqual({
      srr_accession: "SRR123",
      sample_id: "SampleA",
      title: "Study title",
    });
  });

  it("only assigns pending sample IDs to newly added SRA libraries", () => {
    const previous: Library[] = [
      { id: "SRR1", name: "SRR1", type: "sra", sampleId: "Existing" },
    ];
    const next: Library[] = [
      { id: "SRR1", name: "SRR1", type: "sra", sampleId: "Existing" },
      { id: "SRR2", name: "SRR2", type: "sra" },
    ];

    expect(assignSampleIdToNewSraLibraries(next, previous, " Pending ")).toEqual([
      { id: "SRR1", name: "SRR1", type: "sra", sampleId: "Existing" },
      { id: "SRR2", name: "SRR2", type: "sra", sampleId: "Pending" },
    ]);
  });
});
