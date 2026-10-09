import {
  availableMetadataFieldSections,
  createMetadataField,
  defaultMetadataFields,
  formatMetadataLabel,
  metadataFieldIdsFromJob,
  metadataFieldOptions,
  metadataFieldSections,
} from "@/lib/forms/genome-metadata-fields";

describe("metadataFieldSections", () => {
  it("lists every field once, since its id is the Select item's value and key", () => {
    const values = metadataFieldOptions.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
  });

  it("opens with legacy's short list, in its order", () => {
    expect(metadataFieldSections[0]).toEqual({
      label: "Frequent Fields",
      options: expect.any(Array) as unknown,
    });
    expect(metadataFieldSections[0].options.map(({ value }) => value)).toEqual([
      "genome_name",
      "genome_length",
      "feature_group",
      "species",
      "strain",
      "accession",
      "subtype",
      "lineage",
      "host_group",
      "host_common_name",
      "collection_date",
      "collection_year",
      "geographic_group",
      "isolation_country",
      "geographic_location",
    ]);
  });

  it("has no empty section and offers every default field", () => {
    for (const section of metadataFieldSections) {
      expect(section.options.length).toBeGreaterThan(0);
    }
    const values = new Set(metadataFieldOptions.map(({ value }) => value));
    for (const field of defaultMetadataFields) {
      expect(values.has(field.id)).toBe(true);
    }
  });
});

describe("formatMetadataLabel", () => {
  it("title-cases underscore-separated words", () => {
    expect(formatMetadataLabel("genome_name")).toBe("Genome Name");
    expect(formatMetadataLabel("species")).toBe("Species");
    expect(formatMetadataLabel("host_common_name")).toBe("Host Common Name");
  });
});

describe("createMetadataField", () => {
  it("names a field by its option", () => {
    expect(createMetadataField("genome_name")).toEqual({
      id: "genome_name",
      name: "Genome Name",
      selected: true,
    });
    expect(createMetadataField("host_gender").name).toBe("Host Sex");
  });

  it("title-cases an id with no option", () => {
    expect(createMetadataField("unknown_field")).toEqual({
      id: "unknown_field",
      name: "Unknown Field",
      selected: true,
    });
  });
});

describe("availableMetadataFieldSections", () => {
  it("leaves out the selected fields and the sections they empty", () => {
    const sections = availableMetadataFieldSections(
      new Set(["genome_name", "genome_status"]),
    );
    const values = sections.flatMap((section) =>
      section.options.map(({ value }) => value),
    );

    expect(values).not.toContain("genome_name");
    expect(sections.map(({ label }) => label)).not.toContain("Status");
    expect(values).toHaveLength(metadataFieldOptions.length - 2);
  });
});

describe("metadataFieldIdsFromJob", () => {
  it("reads this site's and legacy Viral Genome Tree's genome_metadata_fields", () => {
    expect(
      metadataFieldIdsFromJob({ genome_metadata_fields: ["subtype", "genome_id"] }),
    ).toEqual(["subtype", "genome_id"]);
  });

  it("reads legacy Gene Tree's metadata_fields", () => {
    expect(
      metadataFieldIdsFromJob({ metadata_fields: ["genome_name", "host_group"] }),
    ).toEqual(["genome_name", "host_group"]);
  });

  it("takes only genome fields from feature_metadata_fields", () => {
    expect(
      metadataFieldIdsFromJob({
        genome_metadata_fields: ["genome_id"],
        feature_metadata_fields: ["public", "product", "patric_id"],
      }),
    ).toEqual(["genome_id", "public"]);
  });

  it("lists each field once, and splits a comma-separated value", () => {
    expect(
      metadataFieldIdsFromJob({
        genome_metadata_fields: "genome_id, genome_name",
        metadata_fields: ["genome_name", 42],
      }),
    ).toEqual(["genome_id", "genome_name"]);
  });

  it("returns nothing for a job without metadata fields", () => {
    expect(metadataFieldIdsFromJob({})).toEqual([]);
  });
});
