import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import {
  buildWorkspaceStructureSource,
  canonicalProteinStructureQuery,
  isAlphaFoldId,
  isPdbId,
  maxProteinStructureAccessions,
  normalizeProteinStructureAccessions,
  parseProteinStructureCollectionState,
  parseProteinStructureMode,
  proteinStructureCollectionProfile,
  proteinStructureStructuralRql,
  proteinStructureViewRecordSchema,
  resolveProteinStructureSources,
  featureProteinStructureRql,
} from "@/lib/protein-structure-view";

describe("Protein Structure view contracts", () => {
  it("parses collection, accession, and workspace path modes", () => {
    expect(parseProteinStructureMode({})).toEqual({ kind: "collection" });
    expect(
      parseProteinStructureMode({ accession: " 1abc,AF-P12345-F2 " }),
    ).toEqual({
      kind: "accession",
      accessions: ["1ABC", "AF-P12345-F2"],
    });
    expect(parseProteinStructureMode({ path: "/user/home/model.pdb" })).toEqual(
      {
        kind: "path",
        path: "/user/home/model.pdb",
      },
    );
  });

  it("returns explicit invalid modes for ambiguous or malformed input", () => {
    const ambiguous = parseProteinStructureMode({
      accession: "1ABC",
      path: "/model.pdb",
    });
    expect(ambiguous.kind).toBe("invalid");
    if (ambiguous.kind === "invalid") {
      expect(ambiguous.reason).toMatch(/mutually exclusive/);
    }
    expect(
      parseProteinStructureMode({ path: ["/one.pdb", "/two.pdb"] }),
    ).toMatchObject({
      kind: "invalid",
    });
    const malformed = parseProteinStructureMode({ accession: "not-an-id" });
    expect(malformed.kind).toBe("invalid");
    if (malformed.kind === "invalid") {
      expect(malformed.reason).toContain("NOT-AN-ID");
    }
  });

  it("normalizes, deduplicates, preserves order, and bounds accessions", () => {
    const values = Array.from(
      { length: maxProteinStructureAccessions + 3 },
      (_, index) => `1A${index.toString(36).padStart(2, "0")}`,
    );
    expect(
      normalizeProteinStructureAccessions([
        ` ${values[0].toLowerCase()} ,${values[1]}`,
        values[0],
        ...values.slice(2),
      ]),
    ).toEqual(values.slice(0, maxProteinStructureAccessions));
    expect(parseProteinStructureMode({ accession: values })).toMatchObject({
      kind: "invalid",
    });
    expect(isPdbId("1abc")).toBe(true);
    expect(isAlphaFoldId("af-p12345-f12")).toBe(true);
    expect(isAlphaFoldId("AF-P12345-F0")).toBe(false);
  });

  it("canonicalizes member discriminators while preserving other query state", () => {
    const accessionMode = parseProteinStructureMode({
      accession: ["1abc", "1ABC, af-p12345-f1"],
    });
    expect(accessionMode.kind).toBe("accession");
    if (accessionMode.kind === "accession") {
      expect(
        canonicalProteinStructureQuery(
          { accession: ["1abc", "1ABC, af-p12345-f1"], source: "search" },
          accessionMode,
        ),
      ).toBe("/protein-structure?source=search&accession=1ABC%2CAF-P12345-F1");
    }
  });

  it("passes already-decoded workspace paths straight through (Next decodes searchParams once)", () => {
    // `%20`/`%2E` here are literal characters the workspace item is named
    // with — this is what a real `searchParams.path` value looks like after
    // Next.js has already decoded it once. `parseProteinStructureMode` must
    // not decode it again.
    const mode = parseProteinStructureMode({
      path: "/user name/home/model.bcif",
    });

    expect(mode).toEqual({
      kind: "path",
      path: "/user name/home/model.bcif",
    });
    if (mode.kind === "path") {
      expect(resolveProteinStructureSources({ workspacePath: mode.path })).toEqual([
        {
          url: "/api/workspace/view/user%20name/home/model.bcif",
          format: "bcif",
          label: "model.bcif",
          kind: "workspace",
        },
      ]);
    }
  });

  it("validates workspace paths without re-decoding them", () => {
    expect(
      parseProteinStructureMode({ path: "relative/model.pdb" }),
    ).toMatchObject({ kind: "invalid" });
    expect(
      parseProteinStructureMode({ path: "/user/home/model.txt" }),
    ).toMatchObject({ kind: "invalid" });
    const compressedPath = parseProteinStructureMode({
      path: "/user/home/model.cif.gz",
    });
    expect(compressedPath.kind).toBe("invalid");
    if (compressedPath.kind === "invalid") {
      expect(compressedPath.reason).toContain("uncompressed");
    }
    // An actual ".." segment (what Next would hand us after decoding a real
    // `%2e%2e` traversal attempt in the raw URL) is still rejected.
    expect(
      parseProteinStructureMode({ path: "/user/../model.pdb" }),
    ).toMatchObject({ kind: "invalid" });
    expect(
      parseProteinStructureMode({ path: `/user/${"a".repeat(1024)}.pdb` }),
    ).toMatchObject({ kind: "invalid" });
  });

  it("treats literal percent text and traversal-looking names as valid, not corrupted or rejected", () => {
    // A folder literally named "%2e%2e" is not an actual ".." segment and
    // must not be decoded into one.
    expect(
      parseProteinStructureMode({ path: "/user/%2e%2e/model.pdb" }),
    ).toEqual({ kind: "path", path: "/user/%2e%2e/model.pdb" });

    // A filename containing literal "%2F" text must not be split into two
    // segments — that would resolve a different file than the one named.
    expect(
      parseProteinStructureMode({ path: "/user/folder%2f../model.pdb" }),
    ).toEqual({ kind: "path", path: "/user/folder%2f../model.pdb" });

    // Percent text that looks malformed, but was never re-decoded, must not
    // be rejected as an invalid segment.
    expect(
      parseProteinStructureMode({ path: "/user/%E0%A4%A/model.pdb" }),
    ).toEqual({ kind: "path", path: "/user/%E0%A4%A/model.pdb" });

    // A name that merely contains ".." (not an exact ".." segment) is a
    // valid name, not a traversal attempt.
    expect(
      parseProteinStructureMode({ path: "/user/..hidden/model.pdb" }),
    ).toEqual({ kind: "path", path: "/user/..hidden/model.pdb" });
    expect(
      parseProteinStructureMode({ path: "/user/home/model..old.pdb" }),
    ).toEqual({ kind: "path", path: "/user/home/model..old.pdb" });

    // Spaces are valid.
    expect(
      parseProteinStructureMode({ path: "/user/my folder/model.pdb" }),
    ).toEqual({ kind: "path", path: "/user/my folder/model.pdb" });
  });

  it("resolves a workspace path containing literal %2F to the exact file it names (query-param entrypoint)", () => {
    const mode = parseProteinStructureMode({
      path: "/user/home/weird%2Ffile.pdb",
    });
    expect(mode).toEqual({ kind: "path", path: "/user/home/weird%2Ffile.pdb" });
    if (mode.kind !== "path") throw new Error("expected path mode");

    const [resolved] = resolveProteinStructureSources({
      workspacePath: mode.path,
    });
    expect(resolved).toEqual({
      url: "/api/workspace/view/user/home/weird%252Ffile.pdb",
      format: "pdb",
      label: "weird%2Ffile.pdb",
      kind: "workspace",
    });
    // A single decode (what the workspace proxy route/Next.js itself
    // performs) must land back on the exact original file name, not split
    // it into an extra path segment.
    expect(resolved.url.split("/").map(decodeURIComponent).join("/")).toBe(
      "/api/workspace/view/user/home/weird%2Ffile.pdb",
    );
  });

  it.each([
    ["/user/home/model.pdb", "pdb"],
    ["/user/home/model.PDB", "pdb"],
    ["/user/home/model.cif", "mmcif"],
    ["/user/home/model.CIF", "mmcif"],
    ["/user/home/model.mmcif", "mmcif"],
    ["/user/home/model.MMCIF", "mmcif"],
    ["/user/home/model.bcif", "bcif"],
    ["/user/home/model.BCIF", "bcif"],
  ])(
    "accepts the supported structure extension in %s (case-insensitive)",
    (path, format) => {
      expect(parseProteinStructureMode({ path })).toEqual({
        kind: "path",
        path,
      });
      expect(
        resolveProteinStructureSources({ workspacePath: path }),
      ).toEqual([expect.objectContaining({ format })]);
    },
  );

  describe("buildWorkspaceStructureSource (shared by both structure entrypoints)", () => {
    it("preserves spaces and literal percent text", () => {
      expect(
        buildWorkspaceStructureSource("/user name/home/model 1.cif"),
      ).toEqual({
        url: "/api/workspace/view/user%20name/home/model%201.cif",
        format: "mmcif",
        label: "model 1.cif",
        kind: "workspace",
      });

      expect(
        buildWorkspaceStructureSource("/user/home/100%done.pdb"),
      ).toEqual({
        url: "/api/workspace/view/user/home/100%25done.pdb",
        format: "pdb",
        label: "100%done.pdb",
        kind: "workspace",
      });
    });

    it("preserves a literal %2F in a filename instead of splitting it into a new segment", () => {
      const source = buildWorkspaceStructureSource(
        "/user/home/weird%2Ffile.pdb",
      );
      expect(source).toEqual({
        url: "/api/workspace/view/user/home/weird%252Ffile.pdb",
        format: "pdb",
        label: "weird%2Ffile.pdb",
        kind: "workspace",
      });
      expect(source.url.split("/").map(decodeURIComponent).join("/")).toBe(
        "/api/workspace/view/user/home/weird%2Ffile.pdb",
      );
    });

    it("does not alter traversal-looking names", () => {
      expect(
        buildWorkspaceStructureSource("/user/..hidden/model.pdb"),
      ).toEqual({
        url: "/api/workspace/view/user/..hidden/model.pdb",
        format: "pdb",
        label: "model.pdb",
        kind: "workspace",
      });
    });

    it.each([
      ["model.pdb", "pdb"],
      ["model.PDB", "pdb"],
      ["model.cif", "mmcif"],
      ["model.CIF", "mmcif"],
      ["model.mmcif", "mmcif"],
      ["model.MMCIF", "mmcif"],
      ["model.bcif", "bcif"],
      ["model.BCIF", "bcif"],
    ])("detects the format of %s case-insensitively as %s", (fileName, format) => {
      expect(
        buildWorkspaceStructureSource(`/user/home/${fileName}`),
      ).toMatchObject({ format, label: fileName });
    });

    it("mirrors the catch-all viewer route's path-array-to-source pipeline", () => {
      // The `/viewer/structure/[[...path]]` route hands page.tsx an array of
      // already per-segment-decoded strings; the page joins them with "/"
      // and builds the same source. A literal "%2F" inside one segment must
      // survive as text, not be misread as an extra separator.
      const segments = ["alice@bvbrc", "home", "weird%2Ffile.pdb"];
      expect(buildWorkspaceStructureSource(segments.join("/"))).toEqual({
        url: "/api/workspace/view/alice%40bvbrc/home/weird%252Ffile.pdb",
        format: "pdb",
        label: "weird%2Ffile.pdb",
        kind: "workspace",
      });
    });
  });

  it("supports collection URL state and exact structural filters", () => {
    const state = parseProteinStructureCollectionState({
      keyword: "spike",
      taxon_id: "2697049",
      genome_id: "123.4",
      method: ["X-RAY", "Predicted"],
      page: "3",
      sort: "resolution:desc",
    });
    expect(state).toMatchObject({
      keyword: "spike",
      page: 3,
      sort: "resolution:desc",
      filters: {
        taxon_id: ["2697049"],
        genome_id: ["123.4"],
        method: ["X-RAY", "Predicted"],
      },
    });
    expect(proteinStructureStructuralRql(state)).toBe(
      "and(eq(taxon_lineage_ids,2697049),eq(genome_id,123.4),or(eq(method,X-RAY),eq(method,Predicted)))",
    );
  });

  it("gives explicit RQL precedence and validates sort", () => {
    const state = parseProteinStructureCollectionState({
      rql: "eq(method,Predicted)",
      genome_id: "ignored",
      sort: "missing:asc",
    });
    expect(state.filters).toEqual({});
    expect(state.sort).toBe("unsorted");
    expect(proteinStructureStructuralRql(state)).toBeUndefined();
    expect(() =>
      parseProteinStructureCollectionState({ rql: "sort(+pdb_id)" }),
    ).toThrow("Transport operator");
  });

  it.each([
    "taxon_id",
    "gene",
    "product",
    "sequence_md5",
    "method",
    "pmid",
  ])("rejects sorting by multi-valued field %s", (field) => {
    expect(
      parseProteinStructureCollectionState({ sort: `${field}:asc` }).sort,
    ).toBe("unsorted");
    expect(
      parseProteinStructureCollectionState({ sort: `${field}:desc` }).sort,
    ).toBe("unsorted");
  });

  it("exposes the protein structures guide URL", () => {
    expect(proteinStructureCollectionProfile.guideUrl).toBe(
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/protein_structures.html",
    );
  });

  it("uses pdb_id links and omits unsafe sequence projections", () => {
    expect(proteinStructureCollectionProfile.idField).toBe("pdb_id");
    expect(proteinStructureCollectionProfile.rowLinkField).toBe("pdb_id");
    expect(
      proteinStructureCollectionProfile.rowHref?.({ pdb_id: "1ABC" }),
    ).toBe("/protein-structure?accession=1ABC");
    expect(proteinStructureCollectionProfile.detailFields).not.toContain(
      "sequence",
    );
    expect(proteinStructureCollectionProfile.detailFields).not.toContain(
      "alignments",
    );
    expect(
      proteinStructureCollectionProfile.columns.map((column) => column.id),
    ).not.toContain("sequence");
  });

  it("validates structure metadata while retaining additional fields", () => {
    expect(
      proteinStructureViewRecordSchema.parse({
        pdb_id: "1ABC",
        taxon_id: [562],
        uniprotkb_accession: ["P12345"],
        gene: ["abc"],
        product: ["Example protein"],
        sequence_md5: ["abc123"],
        method: ["X-RAY DIFFRACTION"],
        resolution: 2.1,
        pmid: [123456],
        authors: ["A. Researcher"],
        custom_field: true,
      }),
    ).toMatchObject({ pdb_id: "1ABC", custom_field: true });
    expect(() => proteinStructureViewRecordSchema.parse({})).toThrow();
  });

  it("orders BV-BRC, AlphaFold, and RCSB source candidates", () => {
    expect(
      resolveProteinStructureSources({
        pdb_id: "1abc",
        file_path: "structures/pdb/1abc.pdb.gz",
        uniprotkb_accession: ["P12345"],
        workspacePath: "/user/home/fallback.pdb",
      }),
    ).toEqual([
      {
        url: "/api/structure/structures/pdb/1abc.pdb",
        format: "pdb",
        label: "1ABC",
        kind: "bv-brc",
      },
      {
        url: "https://alphafold.ebi.ac.uk/files/AF-P12345-F1-model_v6.cif",
        format: "mmcif",
        label: "AF-P12345-F1",
        kind: "alphafold",
      },
      {
        url: "https://files.rcsb.org/download/1ABC.cif",
        format: "mmcif",
        label: "1ABC",
        kind: "rcsb",
      },
      {
        url: "/api/workspace/view/user/home/fallback.pdb",
        format: "pdb",
        label: "fallback.pdb",
        kind: "workspace",
      },
    ]);
  });

  it("builds exact feature scope from all available structure identifiers", () => {
    expect(
      featureProteinStructureRql({
        feature_id: "feature-1",
        patric_id: "fig|123.4.peg.5",
        aa_sequence_md5: "abc123",
        uniprotkb_accession: "P12345",
        pdb_accession: "1abc, 2xyz",
      }),
    ).toBe(
      "or(eq(patric_id,fig%7C123.4.peg.5),eq(sequence_md5,abc123),eq(uniprotkb_accession,P12345),eq(pdb_id,1ABC),eq(pdb_id,2XYZ))",
    );
    expect(
      featureProteinStructureRql({ feature_id: "feature-2" }),
    ).toBeUndefined();
  });

  const manifestPath = resolve(
    process.cwd(),
    ".next/server/app/(views)/protein-structure/page_client-reference-manifest.js",
  );

  it.skipIf(!existsSync(manifestPath))(
    "keeps Mol* out of the collection's initial client chunks",
    () => {
      const context: {
        globalThis: { __RSC_MANIFEST?: Record<string, unknown> };
      } = {
        globalThis: {},
      };
      vm.runInNewContext(readFileSync(manifestPath, "utf8"), context);
      const manifest = context.globalThis.__RSC_MANIFEST?.[
        "/(views)/protein-structure/page"
      ] as
        | {
            clientModules?: Record<
              string,
              { chunks?: string[]; async?: boolean }
            >;
          }
        | undefined;
      const collection = Object.entries(manifest?.clientModules ?? {}).find(
        ([name]) => name.endsWith("protein-structure-collection.tsx"),
      )?.[1];
      const member = Object.entries(manifest?.clientModules ?? {}).find(
        ([name]) => name.endsWith("protein-structure-member.tsx"),
      )?.[1];
      expect(collection?.chunks).toBeDefined();
      expect(member?.chunks).toBeDefined();
      expect(collection?.chunks).toEqual(member?.chunks);
      for (const chunk of collection?.chunks ?? []) {
        const contents = readFileSync(
          resolve(process.cwd(), `.next${chunk.replace("/_next", "")}`),
          "utf8",
        );
        expect(contents.toLowerCase()).not.toContain("molstar");
      }
      expect(
        Object.keys(manifest?.clientModules ?? {}).some((name) =>
          name.includes("structure-source-viewer"),
        ),
      ).toBe(false);
    },
  );

  it("resolves AlphaFold identifiers and workspace paths", () => {
    expect(resolveProteinStructureSources({ pdb_id: "AF-Q9Y2X3-F2" })).toEqual([
      {
        url: "https://alphafold.ebi.ac.uk/files/AF-Q9Y2X3-F2-model_v6.cif",
        format: "mmcif",
        label: "AF-Q9Y2X3-F2",
        kind: "alphafold",
      },
    ]);
    expect(
      resolveProteinStructureSources({
        workspacePath: "/user name/home/model 1.cif",
      }),
    ).toEqual([
      {
        url: "/api/workspace/view/user%20name/home/model%201.cif",
        format: "mmcif",
        label: "model 1.cif",
        kind: "workspace",
      },
    ]);
  });
});
