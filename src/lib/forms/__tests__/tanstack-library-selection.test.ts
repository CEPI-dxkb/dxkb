import { renderHook, act } from "@testing-library/react";

import {
  getPairedLibraryId,
  getPairedLibraryName,
  getSingleLibraryName,
  buildBaseLibraryItem,
  findNewSraLibraries,
  useTanstackLibrarySelection,
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

function createMockForm() {
  return {
    setFieldValue: vi.fn(),
    store: {},
  } as never;
}

function createHookConfig(overrides = {}) {
  return {
    form: createMockForm(),
    mapLibraryToItem: (lib: Library) => ({ _id: lib.id, _type: lib.type }),
    fields: { paired: "paired_end_libs", single: "single_end_libs", srr: "srr_ids" },
    ...overrides,
  };
}

describe("useTanstackLibrarySelection", () => {
  describe("addPairedLibrary", () => {
    it("adds a paired library on success", () => {
      const onAfterAdd = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addPairedLibrary({
          read1: "/ws/r1.fq",
          read2: "/ws/r2.fq",
          buildLibrary: (r1, r2, id) => ({
            library: { id, name: `P(${r1}, ${r2})`, type: "paired", files: [r1, r2] },
          }),
          onAfterAdd,
        });
      });

      expect(result.current.selectedLibraries).toHaveLength(1);
      expect(result.current.selectedLibraries[0].type).toBe("paired");
      expect(onAfterAdd).toHaveBeenCalled();
    });

    it("calls onError when read1 is missing", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addPairedLibrary({
          read1: null,
          read2: "/ws/r2.fq",
          buildLibrary: () => ({ library: undefined }),
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("Both read files must be selected for paired library");
      expect(result.current.selectedLibraries).toHaveLength(0);
    });

    it("calls onError when read1 === read2", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addPairedLibrary({
          read1: "/ws/same.fq",
          read2: "/ws/same.fq",
          buildLibrary: () => ({ library: undefined }),
          onError,
          sameFileMessage: "Files must differ",
        });
      });

      expect(onError).toHaveBeenCalledWith("Files must differ");
    });

    it("calls onError for duplicate library", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      // Add first library
      act(() => {
        result.current.addPairedLibrary({
          read1: "/ws/r1.fq",
          read2: "/ws/r2.fq",
          buildLibrary: (r1, r2, id) => ({
            library: { id, name: "P", type: "paired", files: [r1, r2] },
          }),
        });
      });

      // Try to add duplicate
      act(() => {
        result.current.addPairedLibrary({
          read1: "/ws/r1.fq",
          read2: "/ws/r2.fq",
          buildLibrary: (r1, r2, id) => ({
            library: { id, name: "P", type: "paired", files: [r1, r2] },
          }),
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("This paired library has already been added");
    });

    it("calls onError when buildLibrary returns no library", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addPairedLibrary({
          read1: "/ws/r1.fq",
          read2: "/ws/r2.fq",
          buildLibrary: () => ({ error: "Build failed" }),
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("Build failed");
    });
  });

  describe("addSingleLibrary", () => {
    it("adds a single library on success", () => {
      const onAfterAdd = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: read, name: `S(${read})`, type: "single", files: [read] },
          }),
          onAfterAdd,
        });
      });

      expect(result.current.selectedLibraries).toHaveLength(1);
      expect(onAfterAdd).toHaveBeenCalled();
    });

    it("calls onError when read is missing", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: null,
          buildLibrary: () => ({ library: undefined }),
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("Read file must be selected");
    });

    it("calls onError for duplicate with default matcher", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: read, name: "S", type: "single", files: [read] },
          }),
        });
      });

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: read, name: "S", type: "single", files: [read] },
          }),
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("This single library has already been added");
    });

    it("uses custom duplicateMatcher when provided", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: "custom-id", name: "S", type: "single", files: [read] },
          }),
        });
      });

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: "custom-id-2", name: "S", type: "single", files: [read] },
          }),
          duplicateMatcher: (lib, read) => lib.files?.[0] === read,
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("This single library has already been added");
    });

    it("calls onError when buildLibrary returns no library", () => {
      const onError = vi.fn();
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: () => ({ error: "Invalid read" }),
          onError,
        });
      });

      expect(onError).toHaveBeenCalledWith("Invalid read");
    });
  });

  describe("removeLibrary", () => {
    it("removes library by ID", () => {
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: read, name: "S", type: "single", files: [read] },
          }),
        });
      });

      expect(result.current.selectedLibraries).toHaveLength(1);

      act(() => {
        result.current.removeLibrary("/ws/reads.fq");
      });

      expect(result.current.selectedLibraries).toHaveLength(0);
    });

    it("is a no-op when ID does not exist", () => {
      const config = createHookConfig();
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: read, name: "S", type: "single", files: [read] },
          }),
        });
      });

      act(() => {
        result.current.removeLibrary("nonexistent");
      });

      expect(result.current.selectedLibraries).toHaveLength(1);
    });
  });

  describe("setLibraries", () => {
    it("applies all 3 field types to form", () => {
      const mockForm = createMockForm();
      const config = createHookConfig({ form: mockForm });
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      const libraries: Library[] = [
        { id: "p1", name: "P", type: "paired", files: ["/r1", "/r2"] },
        { id: "/s1", name: "S", type: "single", files: ["/s1"] },
        { id: "SRR1", name: "SRR1", type: "sra" },
      ];

      act(() => {
        result.current.setLibraries(libraries);
      });

      expect((mockForm as { setFieldValue: ReturnType<typeof vi.fn> }).setFieldValue).toHaveBeenCalledWith(
        "paired_end_libs",
        [expect.objectContaining({ _id: "p1" })],
      );
      expect((mockForm as { setFieldValue: ReturnType<typeof vi.fn> }).setFieldValue).toHaveBeenCalledWith(
        "single_end_libs",
        [expect.objectContaining({ _id: "/s1" })],
      );
      expect((mockForm as { setFieldValue: ReturnType<typeof vi.fn> }).setFieldValue).toHaveBeenCalledWith(
        "srr_ids",
        ["SRR1"],
      );
    });
  });

  describe("normalizeLibraries", () => {
    it("invokes custom normalizeLibraries callback", () => {
      const normalize = vi.fn((next: Library[]) => next);
      const config = createHookConfig({ normalizeLibraries: normalize });
      const { result } = renderHook(() => useTanstackLibrarySelection(config));

      act(() => {
        result.current.addSingleLibrary({
          read: "/ws/reads.fq",
          buildLibrary: (read) => ({
            library: { id: read, name: "S", type: "single", files: [read] },
          }),
        });
      });

      expect(normalize).toHaveBeenCalled();
    });
  });
});
