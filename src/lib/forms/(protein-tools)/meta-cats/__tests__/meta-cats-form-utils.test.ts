vi.mock("./meta-cats-form-schema", () => ({}));

import {
  parseYearRanges,
  getYearGroupLabels,
  getYearGroupForValue,
  countUniqueGroups,
  getUniqueGroupNames,
  groupNamesSourceText,
  transformMetaCatsParams,
  validateYearRanges,
  createGenomeIdMapFromFeatures,
  buildMetaCatsAutoGroupsFromGenomes,
  removeAutoGroupsByRowIds,
  updateAutoGroupsGroupByRowIds,
  selectedAutoGroupRowIds,
  sortMetaCatsAutoGroups,
} from "../meta-cats-form-utils";

interface AutoGroupItem {
  id: string;
  patric_id: string;
  metadata: string;
  group: string;
  genome_id: string;
  genbank_accessions: string;
  strain: string;
}

function makeAutoGroupItem(overrides: Partial<AutoGroupItem> = {}): AutoGroupItem {
  return {
    id: "row-1",
    patric_id: "fig|123.4",
    metadata: "USA",
    group: "GroupA",
    genome_id: "123.4",
    genbank_accessions: "",
    strain: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseYearRanges
// ---------------------------------------------------------------------------
describe("parseYearRanges", () => {
  it("returns empty array for empty string", () => {
    expect(parseYearRanges("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseYearRanges("   ")).toEqual([]);
  });

  it("parses a single year", () => {
    expect(parseYearRanges("1998")).toEqual([[1998]]);
  });

  it("parses a single range", () => {
    expect(parseYearRanges("1999-2005")).toEqual([[1999, 2005]]);
  });

  it("parses mixed singles and ranges", () => {
    expect(parseYearRanges("1998,1999-2005,2006")).toEqual([
      [1998],
      [1999, 2005],
      [2006],
    ]);
  });

  it("handles spaces between entries", () => {
    expect(parseYearRanges("1998 , 1999 - 2005 , 2006")).toEqual([
      [1998],
      [1999, 2005],
      [2006],
    ]);
  });

  it("skips non-numeric entries gracefully", () => {
    // parseInt("abc") is NaN, so the entry is skipped
    expect(parseYearRanges("abc")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getYearGroupLabels
// ---------------------------------------------------------------------------
describe("getYearGroupLabels", () => {
  it("returns empty array for no ranges", () => {
    expect(getYearGroupLabels([])).toEqual([]);
  });

  it("returns '<=' prefix for a single-element first range when it is the only range", () => {
    expect(getYearGroupLabels([[2000]])).toEqual(["<=2000"]);
  });

  it("returns range label for a two-element first range that is the only range", () => {
    expect(getYearGroupLabels([[2000, 2005]])).toEqual(["2000-2005"]);
  });

  it("applies '<=' to first single and '>=' to last single", () => {
    expect(getYearGroupLabels([[1998], [1999, 2005], [2006]])).toEqual([
      "<=1998",
      "1999-2005",
      ">=2006",
    ]);
  });

  it("handles all ranges (no special prefix)", () => {
    expect(
      getYearGroupLabels([
        [1990, 1995],
        [1996, 2000],
        [2001, 2010],
      ]),
    ).toEqual(["1990-1995", "1996-2000", "2001-2010"]);
  });

  it("handles middle single-value ranges as plain numbers", () => {
    expect(getYearGroupLabels([[1998], [2000], [2005]])).toEqual([
      "<=1998",
      "2000",
      ">=2005",
    ]);
  });
});

// ---------------------------------------------------------------------------
// getYearGroupForValue
// ---------------------------------------------------------------------------
describe("getYearGroupForValue", () => {
  const ranges = [[1998], [1999, 2005], [2006]];
  const groups = ["<=1998", "1999-2005", ">=2006"];

  it("returns null for empty ranges", () => {
    expect(getYearGroupForValue(2000, [], [])).toBeNull();
  });

  it("matches a value to a '<=' group", () => {
    expect(getYearGroupForValue(1990, ranges, groups)).toBe("<=1998");
    expect(getYearGroupForValue(1998, ranges, groups)).toBe("<=1998");
  });

  it("matches a value to a range group", () => {
    expect(getYearGroupForValue(1999, ranges, groups)).toBe("1999-2005");
    expect(getYearGroupForValue(2002, ranges, groups)).toBe("1999-2005");
    expect(getYearGroupForValue(2005, ranges, groups)).toBe("1999-2005");
  });

  it("matches a value to a '>=' group", () => {
    expect(getYearGroupForValue(2006, ranges, groups)).toBe(">=2006");
    expect(getYearGroupForValue(2025, ranges, groups)).toBe(">=2006");
  });

  it("returns null when no group matches", () => {
    // Only plain number groups (middle), value does not match
    const plainGroups = ["2000"];
    expect(getYearGroupForValue(1999, [[2000]], plainGroups)).toBeNull();
  });

  it("matches an exact plain number group", () => {
    expect(getYearGroupForValue(2000, [[2000]], ["2000"])).toBe("2000");
  });
});

// ---------------------------------------------------------------------------
// countUniqueGroups
// ---------------------------------------------------------------------------
describe("countUniqueGroups", () => {
  it("returns 0 for empty array", () => {
    expect(countUniqueGroups([])).toBe(0);
  });

  it("counts distinct group names", () => {
    const items = [
      makeAutoGroupItem({ group: "A" }),
      makeAutoGroupItem({ group: "B" }),
      makeAutoGroupItem({ group: "A" }),
    ];
    expect(countUniqueGroups(items)).toBe(2);
  });

  it("returns 1 when all items share the same group", () => {
    const items = [
      makeAutoGroupItem({ group: "X" }),
      makeAutoGroupItem({ group: "X" }),
    ];
    expect(countUniqueGroups(items)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getUniqueGroupNames
// ---------------------------------------------------------------------------
describe("getUniqueGroupNames", () => {
  it("returns empty array for empty input", () => {
    expect(getUniqueGroupNames([])).toEqual([]);
  });

  it("returns unique group names", () => {
    const items = [
      makeAutoGroupItem({ group: "A" }),
      makeAutoGroupItem({ group: "B" }),
      makeAutoGroupItem({ group: "A" }),
    ];
    const result = getUniqueGroupNames(items);
    expect(result).toHaveLength(2);
    expect(result).toContain("A");
    expect(result).toContain("B");
  });
});

// ---------------------------------------------------------------------------
// groupNamesSourceText
// ---------------------------------------------------------------------------
describe("groupNamesSourceText", () => {
  it("names the chosen metadata by its label", () => {
    expect(groupNamesSourceText("host_name")).toBe(
      "Group names come from the Groups Grid, where each added feature is grouped by its genome's Host Name.",
    );
  });

  it("mentions year ranges for Collection Year", () => {
    expect(groupNamesSourceText("collection_year")).toBe(
      "Group names come from the Groups Grid, where each added feature is grouped by its genome's Collection Year (or its year range, when Year Ranges are set).",
    );
  });

  it("falls back to plain metadata for an unknown field", () => {
    expect(groupNamesSourceText(undefined)).toContain(
      "grouped by its genome's metadata.",
    );
  });
});

// ---------------------------------------------------------------------------
// transformMetaCatsParams
// ---------------------------------------------------------------------------
describe("transformMetaCatsParams", () => {
  const baseData = {
    p_value: 0.05,
    output_path: "/my/path",
    output_file: "result",
    input_type: "auto" as const,
    metadata_group: "host_name",
    year_ranges: "",
    auto_groups: [] as AutoGroupItem[],
    auto_alphabet: "aa" as const,
    groups: [],
    group_alphabet: "aa" as const,
    alignment_file: "",
    alignment_type: "",
    group_file: "",
  };

  it("includes common fields", () => {
    const result = transformMetaCatsParams(baseData);
    expect(result).toEqual(
      expect.objectContaining({
        p_value: 0.05,
        output_path: "/my/path",
        output_file: "result",
        input_type: "auto",
      }),
    );
  });

  it("trims output_file", () => {
    const result = transformMetaCatsParams({ ...baseData, output_file: "  result  " });
    expect(result.output_file).toBe("result");
  });

  describe("input_type 'auto'", () => {
    it("sets alphabet from auto_alphabet", () => {
      const result = transformMetaCatsParams({ ...baseData, auto_alphabet: "na" });
      expect(result.alphabet).toBe("na");
    });

    it("includes metadata_group", () => {
      const result = transformMetaCatsParams(baseData);
      expect(result.metadata_group).toBe("host_name");
    });

    it("includes year_ranges when metadata_group is collection_year", () => {
      const result = transformMetaCatsParams({
        ...baseData,
        metadata_group: "collection_year",
        year_ranges: "1998,2000-2005",
      });
      expect(result.year_ranges).toBe("1998,2000-2005");
    });

    it("does not include year_ranges for other metadata groups", () => {
      const result = transformMetaCatsParams(baseData);
      expect(result.year_ranges).toBeUndefined();
    });

    it("transforms auto_groups to API format", () => {
      const groups = [
        makeAutoGroupItem({
          patric_id: "fig|111.1",
          metadata: "USA",
          group: "G1",
          genome_id: "111.1",
        }),
      ];
      const result = transformMetaCatsParams({ ...baseData, auto_groups: groups });
      expect(result.auto_groups).toEqual([
        { id: "fig|111.1", metadata: "USA", grp: "G1", g_id: "111.1" },
      ]);
    });

    it("does not include auto_groups when array is empty", () => {
      const result = transformMetaCatsParams(baseData);
      expect(result.auto_groups).toBeUndefined();
    });
  });

  describe("input_type 'groups'", () => {
    const groupData = {
      ...baseData,
      input_type: "groups" as const,
      groups: ["grp1", "grp2"],
      group_alphabet: "na" as const,
    };

    it("sets alphabet from group_alphabet", () => {
      expect(transformMetaCatsParams(groupData).alphabet).toBe("na");
    });

    it("includes groups array", () => {
      expect(transformMetaCatsParams(groupData).groups).toEqual(["grp1", "grp2"]);
    });
  });

  describe("input_type 'files'", () => {
    const fileData = {
      ...baseData,
      input_type: "files" as const,
      alignment_file: "/path/to/alignment.fasta",
      group_file: "/path/to/groups.txt",
      alignment_type: "dna",
    };

    it("includes alignment_file and group_file", () => {
      const result = transformMetaCatsParams(fileData);
      expect(result.alignment_file).toBe("/path/to/alignment.fasta");
      expect(result.group_file).toBe("/path/to/groups.txt");
    });

    it("sets alphabet to 'na' for non-protein types", () => {
      expect(transformMetaCatsParams(fileData).alphabet).toBe("na");
    });

    it("sets alphabet to 'aa' for protein types", () => {
      const result = transformMetaCatsParams({
        ...fileData,
        alignment_type: "protein_fasta",
      });
      expect(result.alphabet).toBe("aa");
    });
  });
});

// ---------------------------------------------------------------------------
// validateYearRanges
// ---------------------------------------------------------------------------
describe("validateYearRanges", () => {
  it("returns valid for empty string", () => {
    const result = validateYearRanges("");
    expect(result.valid).toBe(true);
    expect(result.message).toBe("");
  });

  it("returns valid for whitespace-only string", () => {
    expect(validateYearRanges("   ").valid).toBe(true);
  });

  it("returns invalid for letters", () => {
    const result = validateYearRanges("abc");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Invalid");
  });

  it("returns invalid for special characters", () => {
    const result = validateYearRanges("2000;2005");
    expect(result.valid).toBe(false);
  });

  it("returns valid with success message for correct format", () => {
    const result = validateYearRanges("1998,1999-2005,2006");
    expect(result.valid).toBe(true);
    expect(result.message).toContain("3 range(s)");
  });

  it("returns valid for a single year", () => {
    const result = validateYearRanges("2000");
    expect(result.valid).toBe(true);
    expect(result.message).toContain("1 range(s)");
  });
});

// ---------------------------------------------------------------------------
// createGenomeIdMapFromFeatures
// ---------------------------------------------------------------------------
describe("createGenomeIdMapFromFeatures", () => {
  it("returns empty map for empty array", () => {
    const result = createGenomeIdMapFromFeatures([]);
    expect(result.size).toBe(0);
  });

  it("maps genome_id to patric_ids", () => {
    const features = [
      { genome_id: "g1", patric_id: "p1" },
      { genome_id: "g1", patric_id: "p2" },
      { genome_id: "g2", patric_id: "p3" },
    ];
    const result = createGenomeIdMapFromFeatures(features);
    expect(result.get("g1")).toEqual(["p1", "p2"]);
    expect(result.get("g2")).toEqual(["p3"]);
  });

  it("skips features missing genome_id or patric_id", () => {
    const features = [
      { genome_id: "g1" },
      { patric_id: "p1" },
      { genome_id: "g2", patric_id: "p2" },
    ];
    const result = createGenomeIdMapFromFeatures(features);
    expect(result.size).toBe(1);
    expect(result.get("g2")).toEqual(["p2"]);
  });
});

// ---------------------------------------------------------------------------
// buildMetaCatsAutoGroupsFromGenomes
// ---------------------------------------------------------------------------
describe("buildMetaCatsAutoGroupsFromGenomes", () => {
  let idCounter: number;
  const createId = () => `id-${String(idCounter++)}`;

  beforeEach(() => {
    idCounter = 0;
  });

  it("builds auto groups from genomes and feature map", () => {
    const genomes = [
      { genome_id: "g1", host_name: "Human", strain: "strainA" },
    ];
    const genomeIdMap = new Map([["g1", ["p1", "p2"]]]);

    const { newAutoGroups, nextGroupNames } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "host_name",
      existingAutoGroups: [],
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups).toHaveLength(2);
    expect(newAutoGroups[0]).toEqual(
      expect.objectContaining({
        id: "id-0",
        patric_id: "p1",
        metadata: "Human",
        group: "Human",
        genome_id: "g1",
        strain: "strainA",
      }),
    );
    expect(newAutoGroups[1]).toEqual(
      expect.objectContaining({
        id: "id-1",
        patric_id: "p2",
      }),
    );
    expect(nextGroupNames).toContain("Human");
  });

  it("carries each genome's GenBank accessions onto its rows", () => {
    const genomes = [
      { genome_id: "g1", host_name: "Human", genbank_accessions: "UEWB00000000" },
      { genome_id: "g2", host_name: "Human", genbank_accessions: ["CP1", "CP2"] },
      { genome_id: "g3", host_name: "Human" },
    ];
    const genomeIdMap = new Map([
      ["g1", ["p1"]],
      ["g2", ["p2"]],
      ["g3", ["p3"]],
    ]);

    const { newAutoGroups } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "host_name",
      existingAutoGroups: [],
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups.map((item) => item.genbank_accessions)).toEqual([
      "UEWB00000000",
      "CP1, CP2",
      "",
    ]);
  });

  it("deduplicates by patric_id against existing auto groups", () => {
    const genomes = [{ genome_id: "g1", host_name: "Human" }];
    const genomeIdMap = new Map([["g1", ["p1", "p2"]]]);
    const existing = [makeAutoGroupItem({ patric_id: "p1" })];

    const { newAutoGroups } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "host_name",
      existingAutoGroups: existing,
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups).toHaveLength(1);
    expect(newAutoGroups[0].patric_id).toBe("p2");
  });

  it("preserves existing group names in the output", () => {
    const genomes = [{ genome_id: "g1", host_name: "Human" }];
    const genomeIdMap = new Map([["g1", ["p1"]]]);

    const { nextGroupNames } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "host_name",
      existingAutoGroups: [],
      existingGroupNames: ["ExistingGroup"],
      createId,
    });

    expect(nextGroupNames).toContain("ExistingGroup");
    expect(nextGroupNames).toContain("Human");
  });

  it("assigns year group labels when metadata_group is collection_year", () => {
    const genomes = [
      { genome_id: "g1", collection_year: 1995, strain: "" },
      { genome_id: "g2", collection_year: 2002, strain: "" },
      { genome_id: "g3", collection_year: 2010, strain: "" },
    ];
    const genomeIdMap = new Map([
      ["g1", ["p1"]],
      ["g2", ["p2"]],
      ["g3", ["p3"]],
    ]);

    const { newAutoGroups } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "collection_year",
      yearRanges: "1998,1999-2005,2006",
      existingAutoGroups: [],
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups).toHaveLength(3);
    expect(newAutoGroups[0].group).toBe("<=1998");
    expect(newAutoGroups[1].group).toBe("1999-2005");
    expect(newAutoGroups[2].group).toBe(">=2006");
  });

  it("falls back to raw metadata when year value has no matching group", () => {
    const genomes = [{ genome_id: "g1", collection_year: "not-a-number" }];
    const genomeIdMap = new Map([["g1", ["p1"]]]);

    const { newAutoGroups } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "collection_year",
      yearRanges: "1998,2000-2005",
      existingAutoGroups: [],
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups[0].group).toBe("not-a-number");
  });

  it("handles genomes with no matching features in the map", () => {
    const genomes = [{ genome_id: "g1", host_name: "Human" }];
    const genomeIdMap = new Map<string, string[]>();

    const { newAutoGroups } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "host_name",
      existingAutoGroups: [],
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups).toHaveLength(0);
  });

  it("uses empty string for metadata when the field is undefined on the genome", () => {
    const genomes = [{ genome_id: "g1" }];
    const genomeIdMap = new Map([["g1", ["p1"]]]);

    const { newAutoGroups } = buildMetaCatsAutoGroupsFromGenomes({
      genomes,
      genomeIdMap,
      metadataGroup: "host_name",
      existingAutoGroups: [],
      existingGroupNames: [],
      createId,
    });

    expect(newAutoGroups[0].metadata).toBe("");
    expect(newAutoGroups[0].group).toBe("");
  });
});

// ---------------------------------------------------------------------------
// removeAutoGroupsByRowIds
// ---------------------------------------------------------------------------
describe("removeAutoGroupsByRowIds", () => {
  it("returns the original array when selectedRowIds is empty", () => {
    const items = [makeAutoGroupItem({ id: "1" })];
    const result = removeAutoGroupsByRowIds(items, new Set());
    expect(result).toBe(items);
  });

  it("removes items matching the selected ids", () => {
    const items = [
      makeAutoGroupItem({ id: "1" }),
      makeAutoGroupItem({ id: "2" }),
      makeAutoGroupItem({ id: "3" }),
    ];
    const result = removeAutoGroupsByRowIds(items, new Set(["1", "3"]));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("returns empty array when all ids are selected", () => {
    const items = [
      makeAutoGroupItem({ id: "1" }),
      makeAutoGroupItem({ id: "2" }),
    ];
    const result = removeAutoGroupsByRowIds(items, new Set(["1", "2"]));
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateAutoGroupsGroupByRowIds
// ---------------------------------------------------------------------------
describe("updateAutoGroupsGroupByRowIds", () => {
  it("returns the original array when selectedRowIds is empty", () => {
    const items = [makeAutoGroupItem({ id: "1", group: "A" })];
    const result = updateAutoGroupsGroupByRowIds(items, new Set(), "B");
    expect(result).toBe(items);
  });

  it("updates group name for selected rows only", () => {
    const items = [
      makeAutoGroupItem({ id: "1", group: "A" }),
      makeAutoGroupItem({ id: "2", group: "A" }),
      makeAutoGroupItem({ id: "3", group: "B" }),
    ];
    const result = updateAutoGroupsGroupByRowIds(items, new Set(["1", "3"]), "NewGroup");
    expect(result[0].group).toBe("NewGroup");
    expect(result[1].group).toBe("A");
    expect(result[2].group).toBe("NewGroup");
  });

  it("does not mutate original items", () => {
    const items = [makeAutoGroupItem({ id: "1", group: "A" })];
    const result = updateAutoGroupsGroupByRowIds(items, new Set(["1"]), "B");
    expect(items[0].group).toBe("A");
    expect(result[0].group).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// selectedAutoGroupRowIds
// ---------------------------------------------------------------------------
describe("selectedAutoGroupRowIds", () => {
  it("maps the grid's BRC ID selection to the rows' own ids", () => {
    const items = [
      makeAutoGroupItem({ id: "1", patric_id: "fig|1.peg.1" }),
      makeAutoGroupItem({ id: "2", patric_id: "fig|1.peg.2" }),
      makeAutoGroupItem({ id: "3", patric_id: "fig|1.peg.3" }),
    ];
    expect(
      selectedAutoGroupRowIds(items, {
        "fig|1.peg.1": true,
        "fig|1.peg.3": true,
        "fig|gone": true,
      }),
    ).toEqual(new Set(["1", "3"]));
  });
});

// ---------------------------------------------------------------------------
// sortMetaCatsAutoGroups
// ---------------------------------------------------------------------------
describe("sortMetaCatsAutoGroups", () => {
  const items = [
    makeAutoGroupItem({ id: "1", genome_id: "729.10", strain: "B" }),
    makeAutoGroupItem({ id: "2", genome_id: "729.9", strain: "" }),
    makeAutoGroupItem({ id: "3", genome_id: "727.1551", strain: "A" }),
  ];

  it("keeps the grid's order when nothing is sorted", () => {
    expect(sortMetaCatsAutoGroups(items, [])).toBe(items);
  });

  it("sorts numbers inside IDs numerically, in either direction", () => {
    const ascending = sortMetaCatsAutoGroups(items, [
      { id: "genome_id", desc: false },
    ]);
    expect(ascending.map((item) => item.id)).toEqual(["3", "2", "1"]);
    const descending = sortMetaCatsAutoGroups(items, [
      { id: "genome_id", desc: true },
    ]);
    expect(descending.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("puts empty values last in either direction", () => {
    for (const desc of [false, true]) {
      const sorted = sortMetaCatsAutoGroups(items, [{ id: "strain", desc }]);
      expect(sorted[sorted.length - 1].id).toBe("2");
    }
  });
});
