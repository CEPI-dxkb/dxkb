import {
  getPairedLibraryId,
  getPairedLibraryName,
  getSingleLibraryName,
  buildBaseLibraryItem,
  findNewSraLibraries,
} from "@/lib/forms/tanstack-library-selection";
import type { Library } from "@/types/services";

describe("getPairedLibraryId", () => {
  it("concatenates read1 and read2", () => {
    expect(getPairedLibraryId("/ws/r1.fq", "/ws/r2.fq")).toBe(
      "/ws/r1.fq/ws/r2.fq",
    );
  });

  it("works with simple strings", () => {
    expect(getPairedLibraryId("a", "b")).toBe("ab");
  });
});

describe("getPairedLibraryName", () => {
  it("extracts filenames from full paths", () => {
    expect(
      getPairedLibraryName("/workspace/user/file_R1.fq", "/workspace/user/file_R2.fq"),
    ).toBe("P(file_R1.fq, file_R2.fq)");
  });

  it("handles paths with no slashes", () => {
    expect(getPairedLibraryName("read1.fq", "read2.fq")).toBe(
      "P(read1.fq, read2.fq)",
    );
  });

  it("handles deeply nested paths", () => {
    expect(
      getPairedLibraryName("/a/b/c/d/r1.fq.gz", "/a/b/c/d/r2.fq.gz"),
    ).toBe("P(r1.fq.gz, r2.fq.gz)");
  });
});

describe("getSingleLibraryName", () => {
  it("extracts filename from path", () => {
    expect(getSingleLibraryName("/workspace/user/reads.fastq")).toBe(
      "S(reads.fastq)",
    );
  });

  it("handles paths with no slashes", () => {
    expect(getSingleLibraryName("reads.fq")).toBe("S(reads.fq)");
  });
});

describe("buildBaseLibraryItem", () => {
  it("maps a paired library correctly", () => {
    const lib: Library = {
      id: "r1r2",
      name: "P(r1, r2)",
      type: "paired",
      files: ["/ws/r1.fq", "/ws/r2.fq"],
    };
    const result = buildBaseLibraryItem(lib);
    expect(result).toEqual({
      _id: "r1r2",
      _type: "paired",
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
    });
  });

  it("maps a single library correctly", () => {
    const lib: Library = {
      id: "/ws/reads.fq",
      name: "S(reads.fq)",
      type: "single",
      files: ["/ws/reads.fq"],
    };
    const result = buildBaseLibraryItem(lib);
    expect(result).toEqual({
      _id: "/ws/reads.fq",
      _type: "single",
      read: "/ws/reads.fq",
    });
  });

  it("maps an SRA library correctly", () => {
    const lib: Library = {
      id: "SRR12345",
      name: "SRR12345",
      type: "sra",
    };
    const result = buildBaseLibraryItem(lib);
    expect(result).toEqual({
      _id: "SRR12345",
      _type: "srr_accession",
    });
  });

  it("does not set read fields for paired library without files", () => {
    const lib: Library = {
      id: "lib-1",
      name: "lib-1",
      type: "paired",
    };
    const result = buildBaseLibraryItem(lib);
    expect(result._type).toBe("paired");
    expect(result.read1).toBeUndefined();
    expect(result.read2).toBeUndefined();
  });
});

describe("findNewSraLibraries", () => {
  it("finds SRA libs present in next but not in prev", () => {
    const prevLibs: Library[] = [
      { id: "SRR111", name: "SRR111", type: "sra" },
    ];
    const nextLibs: Library[] = [
      { id: "SRR111", name: "SRR111", type: "sra" },
      { id: "SRR222", name: "SRR222", type: "sra" },
    ];
    const result = findNewSraLibraries(nextLibs, prevLibs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("SRR222");
  });

  it("returns empty array when no new SRA libs", () => {
    const libs: Library[] = [
      { id: "SRR111", name: "SRR111", type: "sra" },
    ];
    const result = findNewSraLibraries(libs, libs);
    expect(result).toHaveLength(0);
  });

  it("ignores non-SRA libraries in next", () => {
    const prevLibs: Library[] = [];
    const nextLibs: Library[] = [
      { id: "paired-1", name: "P(r1, r2)", type: "paired", files: ["/r1", "/r2"] },
      { id: "SRR333", name: "SRR333", type: "sra" },
    ];
    const result = findNewSraLibraries(nextLibs, prevLibs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("SRR333");
  });

  it("returns all SRA libs when prev is empty", () => {
    const nextLibs: Library[] = [
      { id: "SRR111", name: "SRR111", type: "sra" },
      { id: "SRR222", name: "SRR222", type: "sra" },
    ];
    const result = findNewSraLibraries(nextLibs, []);
    expect(result).toHaveLength(2);
  });
});
