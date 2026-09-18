import type { DataField, DataFieldMap } from "@/constants/datafields/types";
import { resourceRegistry, type DataResource } from "@/lib/data-api";
import { deriveFieldMetadata } from "../field-metadata";

/**
 * The synthetic maps below reuse real field names so the helper reads real cardinality
 * and sortability out of the Data API registry. `genome` has no array-valued fields at
 * all (`genome_name` is a sortable scalar, `comments` a metadata-unsortable scalar);
 * `strain` supplies the array-valued cases (`taxon_lineage_ids`, `genome_ids`).
 */
function field(name: string, overrides: Partial<DataField> = {}): DataField {
  return {
    label: `Label ${name}`,
    field: name,
    hidden: false,
    group: "Test",
    ...overrides,
  };
}

function map(...fields: DataField[]): DataFieldMap {
  return Object.fromEntries(fields.map((entry) => [entry.field, entry]));
}

describe("registry reconciliation", () => {
  it("treats the fields this suite relies on as the registry describes them", () => {
    expect(resourceRegistry.genome.fields.genome_name).toEqual(
      expect.objectContaining({ cardinality: "scalar", sortable: true }),
    );
    expect(resourceRegistry.genome.fields.comments).toEqual(
      expect.objectContaining({ cardinality: "scalar", sortable: false }),
    );
    expect(resourceRegistry.strain.fields.taxon_lineage_ids).toEqual(
      expect.objectContaining({ cardinality: "multiple", sortable: false }),
    );
    expect(resourceRegistry.strain.fields.genome_ids).toEqual(
      expect.objectContaining({ cardinality: "multiple", sortable: false }),
    );
  });

  it("reads sortability from the registry, not from the field map it is handed", () => {
    // `DataField.sortable` has exactly one consumer — `resources.ts` folds it into
    // `resourceRegistry[resource].fields[name].sortable`, which is also what
    // `validateSort` enforces. Passing a contradicting flag here changes nothing,
    // which is what keeps the table and the API boundary from disagreeing.
    const derived = deriveFieldMetadata(
      map(field("comments", { sortable: true })),
      { resource: "genome" },
    );

    expect(derived.columns[0].sortable).toBe(false);
    expect(derived.sorts).toEqual([]);
  });
});

describe("column and sort derivation", () => {
  interface ColumnCase {
    name: string;
    resource: DataResource;
    field: DataField;
    hiddenColumns?: "collapse" | "omit";
    column: { visible: boolean; sortable: boolean } | "omitted";
    sorted: boolean;
  }

  const columnCases: ColumnCase[] = [
    {
      name: "a plain scalar field becomes a visible, sortable column",
      resource: "genome",
      field: field("genome_name"),
      column: { visible: true, sortable: true },
      sorted: true,
    },
    {
      name: "show_in_table:false removes the column and therefore the sort",
      resource: "genome",
      field: field("genome_name", { show_in_table: false }),
      column: "omitted",
      sorted: false,
    },
    {
      name: "hidden:true collapses the column but keeps it sortable by default",
      resource: "genome",
      field: field("genome_name", { hidden: true }),
      column: { visible: false, sortable: true },
      sorted: true,
    },
    {
      // `hidden` is a visibility flag, not a permission: omitting the column must not
      // silently turn a URL that ordered rows correctly into an unsorted one.
      name: "hidden:true under hiddenColumns:omit removes the column but keeps the sort",
      resource: "genome",
      field: field("genome_name", { hidden: true }),
      hiddenColumns: "omit",
      column: "omitted",
      sorted: true,
    },
    {
      name: "hidden:false under hiddenColumns:omit is untouched",
      resource: "genome",
      field: field("genome_name"),
      hiddenColumns: "omit",
      column: { visible: true, sortable: true },
      sorted: true,
    },
    {
      name: "a metadata-unsortable scalar keeps its column but drops the sort",
      resource: "genome",
      field: field("comments"),
      column: { visible: true, sortable: false },
      sorted: false,
    },
    {
      name: "an array-valued field keeps its column but is never sortable",
      resource: "strain",
      field: field("taxon_lineage_ids"),
      column: { visible: true, sortable: false },
      sorted: false,
    },
    {
      name: "an array-valued field metadata also calls unsortable stays unsortable",
      resource: "strain",
      field: field("genome_ids"),
      column: { visible: true, sortable: false },
      sorted: false,
    },
    {
      name: "an array-valued field can still be a hidden, collapsed column",
      resource: "strain",
      field: field("genome_ids", { hidden: true }),
      column: { visible: false, sortable: false },
      sorted: false,
    },
    {
      name: "an array-valued field stays unsortable even under hiddenColumns:omit",
      resource: "strain",
      field: field("genome_ids", { hidden: true }),
      hiddenColumns: "omit",
      column: "omitted",
      sorted: false,
    },
    {
      name: "show_in_table:false beats hiddenColumns:collapse for the sort too",
      resource: "genome",
      field: field("genome_name", { show_in_table: false, hidden: true }),
      column: "omitted",
      sorted: false,
    },
    {
      name: "a field absent from the registry is not sortable",
      resource: "strain",
      field: field("no_such_strain_field"),
      column: { visible: true, sortable: false },
      sorted: false,
    },
  ];

  it.each(columnCases)("$name", (testCase) => {
    const derived = deriveFieldMetadata(map(testCase.field), {
      resource: testCase.resource,
      hiddenColumns: testCase.hiddenColumns,
    });
    const name = testCase.field.field;

    if (testCase.column === "omitted") {
      expect(derived.columns).toEqual([]);
    } else {
      expect(derived.columns).toEqual([
        {
          id: name,
          label: testCase.field.label,
          visible: testCase.column.visible,
          sortable: testCase.column.sortable,
        },
      ]);
    }

    expect(derived.sorts).toEqual(
      testCase.sorted ? [`${name}:asc`, `${name}:desc`] : [],
    );
    // A dropped column never drops the field from the detail projection.
    expect(derived.detailFields).toEqual([name]);
  });

  it("keeps metadata order in columns and sorts", () => {
    const derived = deriveFieldMetadata(
      map(field("species"), field("genome_ids"), field("strain")),
      { resource: "strain" },
    );


    expect(derived.columns.map((column) => column.id)).toEqual([
      "species",
      "genome_ids",
      "strain",
    ]);
    expect(derived.sorts).toEqual([
      "species:asc",
      "species:desc",
      "strain:asc",
      "strain:desc",
    ]);
  });
});

describe("facet derivation", () => {
  interface FacetCase {
    name: string;
    field: DataField;
    hiddenFacets?: "collapse" | "omit";
    facet: { initiallyVisible: boolean } | "omitted";
    friendlyFilter: boolean;
  }

  const facetCases: FacetCase[] = [
    {
      name: "facet:true becomes an initially visible facet",
      field: field("species", { facet: true }),
      facet: { initiallyVisible: true },
      friendlyFilter: true,
    },
    {
      name: "facet_hidden:true collapses the facet by default",
      field: field("species", { facet: true, facet_hidden: true }),
      facet: { initiallyVisible: false },
      friendlyFilter: true,
    },
    {
      name: "facet_hidden:true under hiddenFacets:omit drops the facet from the query",
      field: field("species", { facet: true, facet_hidden: true }),
      hiddenFacets: "omit",
      facet: "omitted",
      friendlyFilter: true,
    },
    {
      name: "facet_hidden:true without facet:true is inert",
      field: field("species", { facet_hidden: true }),
      facet: "omitted",
      friendlyFilter: false,
    },
    {
      name: "a field with neither flag is not a facet",
      field: field("species"),
      facet: "omitted",
      friendlyFilter: false,
    },
    {
      name: "a hidden, unsortable, array-valued field can still be a facet",
      field: field("genome_ids", { hidden: true, facet: true }),
      facet: { initiallyVisible: true },
      friendlyFilter: true,
    },
  ];

  it.each(facetCases)("$name", (testCase) => {
    const derived = deriveFieldMetadata(map(testCase.field), {
      resource: "strain",
      hiddenFacets: testCase.hiddenFacets,
    });
    const name = testCase.field.field;

    if (testCase.facet === "omitted") {
      expect(derived.facets).toEqual([]);
    } else {
      expect(derived.facets).toEqual([
        {
          field: name,
          label: testCase.field.label,
          initiallyVisible: testCase.facet.initiallyVisible,
        },
      ]);
    }

    // An omitted or collapsed facet is still a legal friendly URL filter name.
    expect(derived.facetFields).toEqual(testCase.friendlyFilter ? [name] : []);
  });
});

describe("excludeFields", () => {
  it("removes the field from every derived output", () => {
    const derived = deriveFieldMetadata(
      map(field("species", { facet: true }), field("strain", { facet: true })),
      { resource: "strain", excludeFields: ["species"] },
    );

    expect(derived.columns.map((column) => column.id)).toEqual(["strain"]);
    expect(derived.detailFields).toEqual(["strain"]);
    expect(derived.facets.map((facet) => facet.field)).toEqual(["strain"]);
    expect(derived.facetFields).toEqual(["strain"]);
    expect(derived.sorts).toEqual(["strain:asc", "strain:desc"]);
  });
});

describe("adaptColumn", () => {
  it("receives the derived column and its source field", () => {
    const seen: { id: string; sortable?: boolean; link?: string }[] = [];
    deriveFieldMetadata(map(field("genbank_accessions", { link: "x/{value}" })), {
      resource: "strain",
      adaptColumn: (column, source) => {
        seen.push({
          id: column.id,
          sortable: column.sortable,
          link: source.link,
        });
        return column;
      },
    });

    expect(seen).toEqual([
      { id: "genbank_accessions", sortable: false, link: "x/{value}" },
    ]);
  });

  it("lets an adapter add link metadata without touching sortability", () => {
    const derived = deriveFieldMetadata(map(field("strain")), {
      resource: "strain",
      adaptColumn: (column) => ({ ...column, valueHref: "https://x/{value}" }),
    });

    expect(derived.columns).toEqual([
      expect.objectContaining({
        id: "strain",
        sortable: true,
        valueHref: "https://x/{value}",
      }),
    ]);
    expect(derived.sorts).toEqual(["strain:asc", "strain:desc"]);
  });

  it("cannot change the URL sort allowlist", () => {
    // `sorts` comes from the field metadata and the registry, never from the adapted
    // columns, so a profile adapter cannot widen or narrow what the URL accepts.
    const narrowed = deriveFieldMetadata(map(field("strain")), {
      resource: "strain",
      adaptColumn: (column) => ({ ...column, sortable: false }),
    });
    expect(narrowed.columns[0].sortable).toBe(false);
    expect(narrowed.sorts).toEqual(["strain:asc", "strain:desc"]);

    const widened = deriveFieldMetadata(map(field("genome_ids")), {
      resource: "strain",
      adaptColumn: (column) => ({ ...column, sortable: true }),
    });
    expect(widened.sorts).toEqual([]);
  });
});

describe("detailFields", () => {
  it("de-duplicates repeated field identifiers", () => {
    const derived = deriveFieldMetadata(
      { first: field("strain"), second: field("strain") },
      { resource: "strain" },
    );

    expect(derived.detailFields).toEqual(["strain"]);
  });
});

it("rejects an unknown resource rather than deriving an empty contract", () => {
  expect(() =>
    deriveFieldMetadata(map(field("strain")), {
      // Deliberately outside DataResource: the registry is the source of truth.
      resource: "not_a_resource" as never,
    }),
  ).toThrow(/Unsupported data resource/);
});
