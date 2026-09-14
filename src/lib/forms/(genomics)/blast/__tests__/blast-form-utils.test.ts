import {
  getAvailableBlastDatabaseTypes,
  getCompatibleBlastDatabaseType,
  getDefaultBlastDatabaseType,
  transformBlastParams,
  resolveDbSource,
  createInputSourceOverrides,
  extractInputFields,
  createBlastFormValues,
  createDatabaseSourceOverrides,
} from "../blast-form-utils";

describe("BLAST database type compatibility", () => {
  const databases = [
    "bacteria-archaea",
    "viral-reference",
    "selGenome",
    "selGroup",
    "selFeatureGroup",
    "selTaxon",
    "selFasta",
  ] as const;

  it.each([
    ["blastn", ["fna", "ffn"], ["fna", "ffn", "frn"], ["fna"]],
    ["blastp", ["faa"], ["faa"], ["faa"]],
    ["blastx", ["faa"], ["faa"], ["faa"]],
    ["tblastn", ["fna", "ffn"], ["fna", "ffn", "frn"], ["fna"]],
  ] as const)(
    "defines every database combination for %s",
    (program, precomputedTypes, selectedTypes, fastaTypes) => {
      for (const database of databases) {
        const expected =
          database === "selFasta"
            ? fastaTypes
            : database === "bacteria-archaea" || database === "viral-reference"
              ? precomputedTypes
              : selectedTypes;
        expect(
          getAvailableBlastDatabaseTypes(program, database).map(
            (type) => type.value,
          ),
          `${program}/${database}`,
        ).toEqual(expected);
        expect(getDefaultBlastDatabaseType(program, database)).toBe(
          expected[0],
        );
      }
    },
  );

  it("preserves every compatible non-default type", () => {
    expect(getCompatibleBlastDatabaseType("ffn", "blastn", "selGenome")).toBe(
      "ffn",
    );
    expect(getCompatibleBlastDatabaseType("frn", "blastn", "selGenome")).toBe(
      "frn",
    );
    expect(
      getCompatibleBlastDatabaseType("ffn", "tblastn", "viral-reference"),
    ).toBe("ffn");
  });

  it("normalizes every incompatible type to the configured default", () => {
    expect(getCompatibleBlastDatabaseType("fna", "blastp", "selGenome")).toBe(
      "faa",
    );
    expect(getCompatibleBlastDatabaseType("faa", "blastn", "selGenome")).toBe(
      "fna",
    );
    expect(getCompatibleBlastDatabaseType("frn", "blastn", "selFasta")).toBe(
      "fna",
    );
  });

  it.each([
    ["unknown", "selGenome"],
    ["blastn", "unknown"],
    ["unknown", "unknown"],
  ])("throws for an unconfigured %s/%s combination", (program, database) => {
    expect(() => getAvailableBlastDatabaseTypes(program, database)).toThrow(
      `No BLAST database types configured for program "${program}" and database "${database}"`,
    );
    expect(() =>
      getCompatibleBlastDatabaseType("fna", program, database),
    ).toThrow();
  });
});

describe("transformBlastParams", () => {
  const baseData = {
    input_type: "dna",
    input_source: "fasta_data",
    db_type: "fna",
    db_source: "precomputed_database",
    db_precomputed_database: "bacteria-archaea",
    blast_program: "blastn",
    output_file: "output.json",
    output_path: "/workspace/user/",
    blast_max_hits: 10,
    blast_evalue_cutoff: 0.001,
    input_fasta_data: ">seq\nACGT",
  };

  it("throws instead of submitting an incompatible database type", () => {
    expect(() =>
      transformBlastParams({
        ...baseData,
        blast_program: "blastp",
        db_type: "fna",
      }),
    ).toThrow(
      'BLAST database type "fna" is incompatible with program "blastp" and database "bacteria-archaea"',
    );
  });

  it("throws instead of submitting an unknown program or database", () => {
    expect(() =>
      transformBlastParams({ ...baseData, blast_program: "unknown" }),
    ).toThrow("No BLAST database types configured");
    expect(() =>
      transformBlastParams({
        ...baseData,
        db_precomputed_database: "unknown",
      }),
    ).toThrow("No BLAST database types configured");
  });

  it("maps all basic fields correctly", () => {
    const result = transformBlastParams(baseData);
    expect(result).toEqual(
      expect.objectContaining({
        input_type: "dna",
        input_source: "fasta_data",
        db_type: "fna",
        db_source: "precomputed_database",
        db_precomputed_database: "bacteria-archaea",
        blast_program: "blastn",
        output_file: "output.json",
        output_path: "/workspace/user/",
        blast_max_hits: 10,
      }),
    );
  });

  it("converts blast_evalue_cutoff to string", () => {
    const result = transformBlastParams(baseData);
    expect(result.blast_evalue_cutoff).toBe("0.001");
  });

  it("includes input_fasta_data when input_source is fasta_data", () => {
    const result = transformBlastParams(baseData);
    expect(result.input_fasta_data).toBe(">seq\nACGT");
    expect(result).not.toHaveProperty("input_fasta_file");
    expect(result).not.toHaveProperty("input_feature_group");
  });

  it("includes input_fasta_file when input_source is fasta_file", () => {
    const data = {
      ...baseData,
      input_source: "fasta_file",
      input_fasta_file: "/path/to/file.fasta",
    };
    const result = transformBlastParams(data);
    expect(result.input_fasta_file).toBe("/path/to/file.fasta");
    expect(result).not.toHaveProperty("input_fasta_data");
  });

  it("includes input_feature_group when input_source is feature_group", () => {
    const data = {
      ...baseData,
      input_source: "feature_group",
      input_feature_group: "/my/feature/group",
    };
    const result = transformBlastParams(data);
    expect(result.input_feature_group).toBe("/my/feature/group");
    expect(result).not.toHaveProperty("input_fasta_data");
  });

  it("includes db_genome_list when db_precomputed_database is selGenome", () => {
    const data = {
      ...baseData,
      db_precomputed_database: "selGenome",
      db_genome_list: ["genome1", "genome2"],
    };
    const result = transformBlastParams(data);
    expect(result.db_genome_list).toEqual(["genome1", "genome2"]);
  });

  it("includes db_genome_group when db_precomputed_database is selGroup", () => {
    const data = {
      ...baseData,
      db_precomputed_database: "selGroup",
      db_genome_group: "/my/genome/group",
    };
    const result = transformBlastParams(data);
    expect(result.db_genome_group).toBe("/my/genome/group");
  });

  it("includes db_feature_group when db_precomputed_database is selFeatureGroup", () => {
    const data = {
      ...baseData,
      db_precomputed_database: "selFeatureGroup",
      db_feature_group: "/my/feature/group",
    };
    const result = transformBlastParams(data);
    expect(result.db_feature_group).toBe("/my/feature/group");
  });

  it("includes db_taxon_list when db_precomputed_database is selTaxon", () => {
    const data = {
      ...baseData,
      db_precomputed_database: "selTaxon",
      db_taxon_list: ["234", "10239"],
    };
    const result = transformBlastParams(data);
    expect(result.db_taxon_list).toEqual(["234", "10239"]);
  });

  it("includes db_fasta_file when db_precomputed_database is selFasta", () => {
    const data = {
      ...baseData,
      db_precomputed_database: "selFasta",
      db_fasta_file: "/path/to/db.fasta",
    };
    const result = transformBlastParams(data);
    expect(result.db_fasta_file).toBe("/path/to/db.fasta");
  });

  it("does not include conditional db fields for precomputed databases", () => {
    const result = transformBlastParams(baseData);
    expect(result).not.toHaveProperty("db_genome_list");
    expect(result).not.toHaveProperty("db_genome_group");
    expect(result).not.toHaveProperty("db_feature_group");
    expect(result).not.toHaveProperty("db_taxon_list");
    expect(result).not.toHaveProperty("db_fasta_file");
  });
});

describe("resolveDbSource", () => {
  it("returns precomputed_database for bacteria-archaea", () => {
    expect(resolveDbSource("bacteria-archaea")).toBe("precomputed_database");
  });

  it("returns precomputed_database for viral-reference", () => {
    expect(resolveDbSource("viral-reference")).toBe("precomputed_database");
  });

  it("returns genome_list for selGenome", () => {
    expect(resolveDbSource("selGenome")).toBe("genome_list");
  });

  it("returns genome_group for selGroup", () => {
    expect(resolveDbSource("selGroup")).toBe("genome_group");
  });

  it("returns feature_group for selFeatureGroup", () => {
    expect(resolveDbSource("selFeatureGroup")).toBe("feature_group");
  });

  it("returns taxon_list for selTaxon", () => {
    expect(resolveDbSource("selTaxon")).toBe("taxon_list");
  });

  it("returns fasta_file for selFasta", () => {
    expect(resolveDbSource("selFasta")).toBe("fasta_file");
  });

  it("defaults to precomputed_database when undefined", () => {
    expect(resolveDbSource(undefined)).toBe("precomputed_database");
  });
});

describe("createInputSourceOverrides", () => {
  it("returns fasta_data source with preserved data", () => {
    const result = createInputSourceOverrides("fasta_data", ">seq\nACGT");
    expect(result).toEqual({
      input_source: "fasta_data",
      input_fasta_data: ">seq\nACGT",
    });
  });

  it("returns fasta_data source with empty string when no preserved data", () => {
    const result = createInputSourceOverrides("fasta_data");
    expect(result).toEqual({
      input_source: "fasta_data",
      input_fasta_data: "",
    });
  });

  it("returns fasta_file source with empty file path", () => {
    const result = createInputSourceOverrides("fasta_file");
    expect(result).toEqual({
      input_source: "fasta_file",
      input_fasta_file: "",
    });
  });

  it("returns feature_group source with empty group", () => {
    const result = createInputSourceOverrides("feature_group");
    expect(result).toEqual({
      input_source: "feature_group",
      input_feature_group: "",
    });
  });

  it("returns only input_source for unknown source type", () => {
    const result = createInputSourceOverrides("unknown" as "fasta_data");
    expect(result).toEqual({ input_source: "unknown" });
  });
});

describe("extractInputFields", () => {
  it("extracts input_source and all input fields", () => {
    const values = {
      input_source: "fasta_data" as const,
      input_fasta_data: ">seq\nACGT",
      input_fasta_file: "/some/file.fasta",
      input_feature_group: "/some/group",
      blast_program: "blastn" as const,
      db_type: "fna" as const,
    };

    const result = extractInputFields(values);
    expect(result).toEqual({
      input_source: "fasta_data",
      input_fasta_data: ">seq\nACGT",
      input_fasta_file: "/some/file.fasta",
      input_feature_group: "/some/group",
    });
  });

  it("does not include non-input fields", () => {
    const values = {
      input_source: "fasta_data" as const,
      input_fasta_data: ">seq\nACGT",
      blast_program: "blastn" as const,
      db_type: "fna" as const,
      output_file: "result.json",
    };

    const result = extractInputFields(values);
    expect(result).not.toHaveProperty("blast_program");
    expect(result).not.toHaveProperty("db_type");
    expect(result).not.toHaveProperty("output_file");
  });

  it("defaults missing input fields to empty strings", () => {
    const values = {
      input_source: "fasta_file" as const,
    };

    const result = extractInputFields(values);
    expect(result).toEqual({
      input_source: "fasta_file",
      input_fasta_data: "",
      input_fasta_file: "",
      input_feature_group: "",
    });
  });

  it("converts non-string input field values to strings", () => {
    const values = {
      input_source: "fasta_data" as const,
      input_fasta_data: undefined,
      input_fasta_file: null,
      input_feature_group: undefined,
    } as unknown as Parameters<typeof extractInputFields>[0];

    const result = extractInputFields(values);
    expect(result.input_fasta_data).toBe("");
    expect(result.input_fasta_file).toBe("");
    expect(result.input_feature_group).toBe("");
  });
});

describe("createBlastFormValues", () => {
  it("merges currentValues with overrides", () => {
    const current = {
      blast_program: "blastn" as const,
      output_file: "my-output",
      blast_max_hits: 50,
    };
    const overrides = { blast_max_hits: 100 };

    const result = createBlastFormValues(current, overrides);

    expect(result.output_file).toBe("my-output");
    expect(result.blast_max_hits).toBe(100);
  });

  it("derives input_type as dna from blastn", () => {
    const result = createBlastFormValues({}, { blast_program: "blastn" });
    expect(result.input_type).toBe("dna");
  });

  it("derives input_type as aa from blastp", () => {
    const result = createBlastFormValues({}, { blast_program: "blastp" });
    expect(result.input_type).toBe("aa");
  });

  it("derives input_type as aa from tblastn", () => {
    const result = createBlastFormValues({}, { blast_program: "tblastn" });
    expect(result.input_type).toBe("aa");
  });

  it("derives db_source from db_precomputed_database", () => {
    const result = createBlastFormValues(
      {},
      { db_precomputed_database: "selGenome" },
    );
    expect(result.db_source).toBe("genome_list");
  });

  it("override values take precedence over derived values", () => {
    const result = createBlastFormValues(
      {},
      { blast_program: "blastn", input_type: "aa", db_source: "fasta_file" },
    );

    expect(result.input_type).toBe("aa");
    expect(result.db_source).toBe("fasta_file");
  });

  it("defaults missing fields", () => {
    const result = createBlastFormValues({}, {});

    expect(result.blast_program).toBe("blastn");
    expect(result.db_precomputed_database).toBe("bacteria-archaea");
    expect(result.input_source).toBe("fasta_data");
    expect(result.blast_evalue_cutoff).toBe(0.0001);
  });
});

describe("createDatabaseSourceOverrides", () => {
  it("returns correct overrides for selGenome", () => {
    const result = createDatabaseSourceOverrides("selGenome", {});

    expect(result.db_source).toBe("genome_list");
    expect(result.db_precomputed_database).toBe("selGenome");
    expect(result.db_genome_list).toEqual([]);
  });

  it("returns correct overrides for selGroup", () => {
    const result = createDatabaseSourceOverrides("selGroup", {});

    expect(result.db_source).toBe("genome_group");
    expect(result.db_genome_group).toBe("");
  });

  it("returns correct overrides for selFasta", () => {
    const result = createDatabaseSourceOverrides("selFasta", {});

    expect(result.db_source).toBe("fasta_file");
    expect(result.db_fasta_file).toBe("");
  });

  it("returns correct overrides for selFeatureGroup", () => {
    const result = createDatabaseSourceOverrides("selFeatureGroup", {});

    expect(result.db_source).toBe("feature_group");
    expect(result.db_feature_group).toBe("");
  });

  it("returns correct overrides for selTaxon", () => {
    const result = createDatabaseSourceOverrides("selTaxon", {});

    expect(result.db_source).toBe("taxon_list");
    expect(result.db_taxon_list).toEqual([]);
  });

  it("resets all db-conditional fields when switching", () => {
    const result = createDatabaseSourceOverrides("selGenome", {});

    expect(result.db_genome_group).toBe("");
    expect(result.db_feature_group).toBe("");
    expect(result.db_taxon_list).toEqual([]);
    expect(result.db_fasta_file).toBe("");
  });

  it("preserves input fields passed as second argument", () => {
    const preserved = {
      input_source: "fasta_data" as const,
      input_fasta_data: ">seq\nACGT",
    };
    const result = createDatabaseSourceOverrides("bacteria-archaea", preserved);

    expect(result.input_source).toBe("fasta_data");
    expect(result.input_fasta_data).toBe(">seq\nACGT");
  });

  it("throws for invalid database source", () => {
    expect(() =>
      createDatabaseSourceOverrides("nonexistent" as "bacteria-archaea", {}),
    ).toThrow("Invalid database source: nonexistent");
  });
});
