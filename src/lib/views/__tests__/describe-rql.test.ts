import {
  collectionFieldLabeler,
  describeRql,
  type RqlFieldLabeler,
} from "../describe-rql";
import { featureCollectionProfile } from "@/lib/feature-view/profile";
import { taxonomyFeaturesHref } from "@/lib/taxonomy-view/actions";

const labelFor: RqlFieldLabeler = (field) =>
  ({
    genome_status: "Genome Status",
    host_name: "Host Name",
    genome_length: "Length",
    annotation: "Annotation",
    sequence_id: "Sequence ID",
    feature_type: "Feature Type",
    public: "Public",
  })[field] ?? field;

function rqlOf(href: string): string {
  const prefix = "?rql=";
  return href.slice(href.indexOf(prefix) + prefix.length);
}

describe("describeRql", () => {
  it.each([
    [
      "genome() as Genome where",
      "genome_feature",
      "genome(eq(genome_status,Complete))",
      ["Genome where Genome Status is Complete"],
    ],
    [
      "a compound genome() operand in parentheses",
      "genome_feature",
      "and(genome(and(eq(genome_status,Complete),eq(host_name,Human))),eq(annotation,PATRIC))",
      [
        "Genome where (Genome Status is Complete and Host Name is Human)",
        "Annotation is PATRIC",
      ],
    ],
    [
      "keyword with its quotes kept",
      "genome_feature",
      'keyword("Rv0001")',
      ['Keyword "Rv0001"'],
    ],
    [
      "ne(field,*) as has no value",
      "genome",
      "ne(host_name,*)",
      ["Host Name has no value"],
    ],
    [
      "an empty value as (empty)",
      "genome",
      'eq(host_name,"")',
      ["Host Name is (empty)"],
    ],
    [
      "lt, le and ge as symbols",
      "genome",
      "and(lt(genome_length,10),le(genome_length,20),ge(genome_length,30))",
      ["Length < 10", "Length ≤ 20", "Length ≥ 30"],
    ],
    [
      "boolean and number values",
      "genome",
      "and(eq(public,true),eq(genome_length,5000))",
      ["Public is true", "Length is 5000"],
    ],
  ] as const)("words %s", (_name, resource, rql, expected) => {
    expect(describeRql(resource, rql, labelFor)).toEqual(expected);
  });

  it("tells the labeler which resource a field belongs to", () => {
    const labeler = vi.fn<RqlFieldLabeler>((field) => field);
    describeRql(
      "genome_feature",
      "and(eq(annotation,PATRIC),genome(eq(genome_status,Complete)))",
      labeler,
    );
    expect(labeler.mock.calls).toEqual([
      ["annotation", "genome_feature"],
      ["genome_status", "genome"],
    ]);
  });

  it("lists each top-level and() operand on its own line", () => {
    expect(
      describeRql(
        "genome_feature",
        "and(eq(annotation,PATRIC),eq(sequence_id,1282460.2049.con.0001),eq(feature_type,CDS))",
        labelFor,
      ),
    ).toEqual([
      "Annotation is PATRIC",
      "Sequence ID is 1282460.2049.con.0001",
      "Feature Type is CDS",
    ]);
  });

  it("decodes percent-escapes and quoted values", () => {
    expect(
      describeRql("genome", 'eq(host_name,"Homo%20sapiens")', labelFor),
    ).toEqual(["Host Name is Homo sapiens"]);
  });

  it("words comparisons and wildcards", () => {
    expect(
      describeRql(
        "genome",
        "and(ne(genome_status,WGS),gt(genome_length,1000),eq(host_name,*))",
        labelFor,
      ),
    ).toEqual([
      "Genome Status is not WGS",
      "Length > 1000",
      "Host Name has a value",
    ]);
  });

  it("collapses a long in() list after four values", () => {
    expect(
      describeRql(
        "genome",
        "in(genome_status,(A,B,C,D,E,F))",
        labelFor,
      ),
    ).toEqual(["Genome Status is one of A, B, C, D and 2 more"]);
  });

  it("keeps a short in() list whole", () => {
    expect(
      describeRql("genome", "in(genome_id,(641501.3,641501.4))", labelFor),
    ).toEqual(["genome_id is one of 641501.3, 641501.4"]);
  });

  it("renders or() as one line and parenthesises nested logic", () => {
    expect(
      describeRql(
        "genome",
        "and(or(eq(genome_status,Complete),eq(genome_status,WGS)),eq(host_name,Human))",
        labelFor,
      ),
    ).toEqual([
      "(Genome Status is Complete or Genome Status is WGS)",
      "Host Name is Human",
    ]);
    expect(
      describeRql(
        "genome",
        "or(eq(genome_status,Complete),eq(genome_status,WGS))",
        labelFor,
      ),
    ).toEqual(["Genome Status is Complete or Genome Status is WGS"]);
  });

  it("words not()", () => {
    expect(
      describeRql("genome", "not(eq(genome_status,WGS))", labelFor),
    ).toEqual(["not (Genome Status is WGS)"]);
  });

  it("returns null when the string does not parse", () => {
    expect(describeRql("genome", "eq(no_such_field,x)", labelFor)).toBeNull();
    expect(describeRql("genome", "not rql at all", labelFor)).toBeNull();
  });
});

describe("describeRql with the collection's real labels", () => {
  const featureLabels = collectionFieldLabeler(featureCollectionProfile);

  it("labels a Feature field that has no column, from its field metadata", () => {
    // sequence_id is a hidden field Feature omits from its columns and facets.
    expect(
      featureCollectionProfile.columns.some(
        (column) => column.id === "sequence_id",
      ),
    ).toBe(false);
    expect(
      describeRql(
        "genome_feature",
        "and(eq(annotation,PATRIC),eq(sequence_id,1282460.2049.con.0001),eq(feature_type,CDS))",
        featureLabels,
      ),
    ).toEqual([
      "Annotation is PATRIC",
      "Sequence ID is 1282460.2049.con.0001",
      "Feature Type is CDS",
    ]);
  });

  it("labels the fields of the Taxonomy → Features genome() operand as genome fields", () => {
    expect(
      describeRql(
        "genome_feature",
        rqlOf(taxonomyFeaturesHref(["234", "10239"])),
        featureLabels,
      ),
    ).toEqual([
      "Genome ID has a value",
      "Genome where (Taxon Lineage IDs is one of 234, 10239 and Genome Status is not Deprecated)",
      "Annotation is PATRIC",
    ]);
  });

  it("keeps the raw id of a field no metadata labels", () => {
    // sp_gene has no field metadata; its id field exists only in the registry.
    expect(
      describeRql(
        "sp_gene",
        "eq(id,VFDB_1)",
        collectionFieldLabeler({ resource: "sp_gene", columns: [] }),
      ),
    ).toEqual(["id is VFDB_1"]);
  });
});

describe("collectionFieldLabeler", () => {
  const labeler = collectionFieldLabeler({
    resource: "genome",
    columns: [
      { id: "genome_status", label: "Status" },
      { id: "sequence_id", label: "Own Sequence" },
    ],
    facets: [
      { field: "genome_status", label: "Facet Status" },
      { field: "host_name", label: "Host" },
    ],
  });

  it("prefers the collection's column, then facet, label for its own resource", () => {
    expect(labeler("genome_status", "genome")).toBe("Status");
    expect(labeler("host_name", "genome")).toBe("Host");
    // Neither a column nor a facet: the genome field metadata.
    expect(labeler("genome_length", "genome")).toBe("Size");
  });

  it("ignores the collection's labels for another resource's field", () => {
    expect(labeler("sequence_id", "genome_sequence")).toBe("Sequence ID");
  });
});
