import { epitopeAssayMetadata, epitopeMetadata } from "@/lib/epitope-view/fields";
import { biosetMetadata, experimentMetadata } from "@/lib/experiment-view/fields";
import { featureMetadata } from "@/lib/feature-view/fields";
import { featureCollectionOptions } from "@/lib/feature-view/query";
import { genomeMetadata } from "@/lib/genome-view/fields";
import { proteinFeatureMetadata } from "@/lib/protein-feature-view/fields";
import { proteinStructureMetadata } from "@/lib/protein-structure-view/fields";
import { serologyMetadata } from "@/lib/serology-view/fields";
import { strainMetadata } from "@/lib/strain-view/fields";
import { surveillanceMetadata } from "@/lib/surveillance-view/fields";
import { taxonomyMetadata } from "@/lib/taxonomy-view/fields";
import { biosetFields } from "@/constants/datafields/bioset";
import { epitopeFields } from "@/constants/datafields/epitope";
import { epitopeAssayFields } from "@/constants/datafields/epitope_assay";
import { experimentFields } from "@/constants/datafields/experiment";
import { genomeFields } from "@/constants/datafields/genome";
import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { proteinStructureFields } from "@/constants/datafields/protein_structure";
import { serologyFields } from "@/constants/datafields/serology";
import { strainFields } from "@/constants/datafields/strain";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import { taxonomyFields } from "@/constants/datafields/taxonomy";
import type { DataField, DataFieldMap } from "@/constants/datafields/types";
import { resourceRegistry, type DataResource } from "@/lib/data-api";
import { validateDataApiRequest } from "@/lib/data-api/validation";
import type { DerivedFieldMetadata } from "../field-metadata";
import {
  featureColumns as childFeatureColumns,
  genomeSequenceColumns,
  interactionColumns,
  sequenceFeatureColumns,
} from "../child-resources";

interface DerivedCase {
  name: string;
  resource: DataResource;
  fieldMap: DataFieldMap;
  metadata: DerivedFieldMetadata;
}

const derived: DerivedCase[] = [
  { name: "epitope", resource: "epitope", metadata: epitopeMetadata, fieldMap: epitopeFields },
  {
    name: "epitope_assay",
    resource: "epitope_assay",
    fieldMap: epitopeAssayFields,
    metadata: epitopeAssayMetadata,
  },
  { name: "experiment", resource: "experiment", metadata: experimentMetadata, fieldMap: experimentFields },
  { name: "bioset", resource: "bioset", metadata: biosetMetadata, fieldMap: biosetFields },
  {
    name: "genome_feature",
    resource: "genome_feature",
    fieldMap: genomeFeatureFields,
    metadata: featureMetadata,
  },
  { name: "genome", resource: "genome", metadata: genomeMetadata, fieldMap: genomeFields },
  {
    name: "protein_feature",
    resource: "protein_feature",
    fieldMap: proteinFeatureFields,
    metadata: proteinFeatureMetadata,
  },
  {
    name: "protein_structure",
    resource: "protein_structure",
    fieldMap: proteinStructureFields,
    metadata: proteinStructureMetadata,
  },
  { name: "serology", resource: "serology", metadata: serologyMetadata, fieldMap: serologyFields },
  { name: "strain", resource: "strain", metadata: strainMetadata, fieldMap: strainFields },
  {
    name: "surveillance",
    resource: "surveillance",
    fieldMap: surveillanceFields,
    metadata: surveillanceMetadata,
  },
  { name: "taxonomy", resource: "taxonomy", fieldMap: taxonomyFields, metadata: taxonomyMetadata },
];

describe.each(derived)(
  "$name derived field contract",
  ({ resource, fieldMap, metadata }) => {
  const registryFields = resourceRegistry[resource].fields;
  const sourceFields = new Map<string, DataField>(
    Object.values(fieldMap).map((entry) => [entry.field, entry]),
  );

  it("accepts a sort only for a field the registry calls sortable", () => {
    for (const sort of metadata.sorts) {
      const [name, direction] = sort.split(":");
      expect(direction).toMatch(/^(asc|desc)$/);
      expect(registryFields[name]).toEqual(
        expect.objectContaining({ cardinality: "scalar", sortable: true }),
      );
    }
  });

  it("accepts a sort only for a field that would become a column", () => {
    for (const sort of metadata.sorts) {
      const [name] = sort.split(":");
      expect(sourceFields.get(name)).toEqual(
        expect.objectContaining({ field: name }),
      );
      expect(sourceFields.get(name)?.show_in_table).not.toBe(false);
    }
  });

  it("accepts a sort with no column only for a field the resource hides", () => {
    // Feature omits its hidden columns; the sorts survive because `hidden` is a
    // visibility flag, not a permission. No other shape of unbacked sort is allowed.
    const columnIds = new Set(metadata.columns.map((column) => column.id));
    for (const sort of metadata.sorts) {
      const [name] = sort.split(":");
      if (columnIds.has(name)) continue;
      expect(sourceFields.get(name)).toEqual(
        expect.objectContaining({ hidden: true }),
      );
    }
  });

  it("offers a sortable header only where a sort would be accepted", () => {
    for (const column of metadata.columns) {
      if (column.sortable !== false) {
        expect(metadata.sorts).toContain(`${column.id}:asc`);
      } else {
        expect(metadata.sorts).not.toContain(`${column.id}:asc`);
      }
    }
  });

  it("survives the real Data API sort validator for every accepted sort", () => {
    for (const sort of metadata.sorts) {
      const [field, direction] = sort.split(":");
      expect(() =>
        validateDataApiRequest(resource, {
          operation: "collection",
          sort: { field, direction },
        }),
      ).not.toThrow();
    }
  });

  const refusedColumns = metadata.columns.filter(
    (column) => column.sortable === false,
  );

  // Skipped rather than silently vacuous: a resource with no unsortable column has
  // nothing to assert here, and that should be visible in the run.
  it.skipIf(refusedColumns.length === 0)(
    "rejects every unsortable column's sort at the Data API boundary too",
    () => {
      expect(refusedColumns.length).toBeGreaterThan(0);
      for (const refused of refusedColumns) {
        expect(() =>
          validateDataApiRequest(resource, {
            operation: "collection",
            sort: { field: refused.id, direction: "asc" },
          }),
        ).toThrow(/cannot sort/);
      }
    },
  );

  it("projects only selectable fields", () => {
    expect(metadata.detailFields.length).toBeGreaterThan(0);
    for (const name of metadata.detailFields) {
      expect(registryFields[name]).toEqual(
        expect.objectContaining({ selectable: true }),
      );
    }
    expect(() =>
      validateDataApiRequest(resource, {
        operation: "collection",
        fields: [...metadata.detailFields],
      }),
    ).not.toThrow();
  });

  it("projects every column it renders", () => {
    for (const column of metadata.columns) {
      expect(metadata.detailFields).toContain(column.id);
    }
  });

  it("requests only fields the Data API accepts as facets", () => {
    for (const facet of metadata.facets) {
      expect(registryFields[facet.field]).toEqual(
        expect.objectContaining({ facet: true }),
      );
    }
    expect(() =>
      validateDataApiRequest(resource, {
        operation: "collection",
        facets: metadata.facets.map((facet) => facet.field),
      }),
    ).not.toThrow();
  });

  it("keeps every requestable facet inside the friendly-filter name list", () => {
    for (const facet of metadata.facets) {
      expect(metadata.facetFields).toContain(facet.field);
    }
  });

  // Pins facet *composition*, not just membership: only Feature omits facets, so every
  // other resource must request every field it flags `facet`. Without this, adding
  // `hiddenFacets: "omit"` to a resource would silently drop facets (17 for
  // Surveillance, 24 for Genome) with every other invariant here still passing.
  it.skipIf(resource === "genome_feature")(
    "requests every facet field it flags, collapsed rather than omitted",
    () => {
      expect(metadata.facets.map((facet) => facet.field)).toEqual([
        ...metadata.facetFields,
      ]);
    },
  );
  },
);

describe("hidden-field policy", () => {
  it("omits Feature's hidden fields from columns while keeping their sorts", () => {
    // `plfam_id` is hidden, show_in_table, and a registry-sortable scalar. Feature
    // renders no column for it, but `sort=plfam_id:asc` orders rows correctly, so the
    // allowlist must keep accepting it — dropping it would turn a working URL into a
    // silent fallback to unsorted.
    expect(resourceRegistry.genome_feature.fields.plfam_id.sortable).toBe(true);
    expect(featureMetadata.columns.map((column) => column.id)).not.toContain(
      "plfam_id",
    );
    expect(featureMetadata.sorts).toContain("plfam_id:asc");
    expect(featureMetadata.sorts).toContain("plfam_id:desc");
    // The detail panel still projects it.
    expect(featureMetadata.detailFields).toContain("plfam_id");
  });

  it("keeps every hidden Feature scalar sortable, not just plfam_id", () => {
    const hiddenSortable = (Object.values(genomeFeatureFields) as DataField[])
      .filter(
        (entry) =>
          entry.hidden &&
          entry.show_in_table !== false &&
          resourceRegistry.genome_feature.fields[entry.field].sortable,
      )
      .map((entry) => entry.field);

    expect(hiddenSortable).toHaveLength(23);
    for (const name of hiddenSortable) {
      expect(featureMetadata.sorts).toContain(`${name}:asc`);
      expect(featureMetadata.columns.map((column) => column.id)).not.toContain(
        name,
      );
    }
  });

  it("documents Feature's sort allowlist as wider than its sortable columns", () => {
    const columnIds = new Set(featureMetadata.columns.map((c) => c.id));
    const unbacked = featureMetadata.sorts
      .filter((sort) => !columnIds.has(sort.split(":")[0]))
      .map((sort) => sort.split(":")[0]);

    expect(new Set(unbacked).size).toBe(23);
  });

  it("keeps every other resource's allowlist equal to its sortable columns", () => {
    for (const { resource, metadata } of derived) {
      if (resource === "genome_feature") continue;
      const sortableColumns = metadata.columns
        .filter((column) => column.sortable !== false)
        .map((column) => column.id);
      expect(metadata.sorts).toEqual(
        sortableColumns.flatMap((id) => [`${id}:asc`, `${id}:desc`]),
      );
    }
  });

  it("renders no hidden Feature column at all", () => {
    expect(
      featureMetadata.columns.every((column) => column.visible === true),
    ).toBe(true);
  });

  it("keeps Strain's hidden fields as collapsed columns", () => {
    expect(strainMetadata.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "taxon_id", visible: false }),
      ]),
    );
    expect(strainMetadata.sorts).toContain("taxon_id:asc");
  });
});

describe("hidden-facet policy", () => {
  it("drops Feature's high-cardinality hidden facets from the combined query", () => {
    // Fetching the gene/product/plfam_id/pgfam_id/go/property facets times the upstream
    // combined query out.
    for (const name of ["gene", "product", "plfam_id", "pgfam_id", "go", "property"]) {
      expect(resourceRegistry.genome_feature.fields[name].facet).toBe(true);
      expect(featureMetadata.facets.map((facet) => facet.field)).not.toContain(
        name,
      );
      // `facetFields` still lists it, because that list is derived from the `facet` flag
      // alone. That does NOT make it a legal Feature URL filter: Feature hard-codes
      // `friendlyFilters` in query.ts and never consumes `facetFields`. This assertion is
      // a shape check on the derivation, not a statement about accepted filters.
      expect(featureMetadata.facetFields).toContain(name);
    }
    expect(featureMetadata.facets.map((facet) => facet.field)).toEqual([
      "annotation",
      "feature_type",
    ]);
  });

  it("is the only resource whose facetFields exceed its facets, and does not consume them", () => {
    // The one place `facets` and `facetFields` diverge is also the one place the wider
    // list is unused, so no resource today turns an omitted facet into a URL filter.
    expect(featureMetadata.facetFields).not.toEqual([
      ...featureMetadata.facets.map((facet) => facet.field),
    ]);
    expect(featureCollectionOptions.friendlyFilters).toEqual([
      "genome_id",
      "annotation",
      "feature_type",
      "filter",
    ]);
    for (const name of ["gene", "product", "plfam_id", "pgfam_id", "go", "property"]) {
      expect(featureCollectionOptions.friendlyFilters).not.toContain(name);
    }
  });

  it("keeps every other resource's hidden facets, collapsed", () => {
    expect(genomeMetadata.facets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "genus", initiallyVisible: false }),
      ]),
    );
    expect(strainMetadata.facets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "host_name", initiallyVisible: false }),
      ]),
    );
  });
});

describe("multi-value fields", () => {
  it("never advertises a sort for an array-valued field", () => {
    for (const { resource, metadata } of derived) {
      const arrayValued = Object.entries(resourceRegistry[resource].fields)
        .filter(([, definition]) => definition.cardinality === "multiple")
        .map(([name]) => name);

      for (const name of arrayValued) {
        expect(metadata.sorts).not.toContain(`${name}:asc`);
        expect(metadata.sorts).not.toContain(`${name}:desc`);
      }
    }
  });

  it("stops Epitope's array-valued host_name from claiming a sortable header", () => {
    expect(resourceRegistry.epitope.fields.host_name.cardinality).toBe(
      "multiple",
    );
    expect(epitopeMetadata.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "host_name", sortable: false }),
      ]),
    );
    expect(epitopeMetadata.sorts).not.toContain("host_name:asc");
    // It remains a facet and a projected field.
    expect(epitopeMetadata.facets.map((facet) => facet.field)).toContain(
      "host_name",
    );
    expect(epitopeMetadata.detailFields).toContain("host_name");
  });

  it("stops Surveillance's array-valued pathogen_test_type from claiming a sortable header", () => {
    expect(
      resourceRegistry.surveillance.fields.pathogen_test_type.cardinality,
    ).toBe("multiple");
    expect(surveillanceMetadata.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pathogen_test_type",
          visible: true,
          sortable: false,
        }),
      ]),
    );
    expect(surveillanceMetadata.sorts).not.toContain("pathogen_test_type:asc");
  });

  it("keeps Strain's segment and accession columns unsortable", () => {
    const unsortable = strainMetadata.columns
      .filter((column) => column.sortable === false)
      .map((column) => column.id);

    expect(unsortable).toEqual([
      "genome_ids",
      "genbank_accessions",
      "1_pb2",
      "2_pb1",
      "3_pa",
      "4_ha",
      "5_np",
      "6_na",
      "7_mp",
      "8_ns",
      "other_segments",
    ]);
  });
});

describe("projection safety", () => {
  it("never projects Protein Structure's whole-molecule payloads", () => {
    for (const unsafe of ["sequence", "alignments"]) {
      expect(proteinStructureMetadata.detailFields).not.toContain(unsafe);
      expect(
        proteinStructureMetadata.columns.map((column) => column.id),
      ).not.toContain(unsafe);
      expect(
        proteinStructureMetadata.facets.map((facet) => facet.field),
      ).not.toContain(unsafe);
      expect(proteinStructureMetadata.sorts).not.toContain(`${unsafe}:asc`);
    }
  });
});

describe("profile column adapters", () => {
  it("keeps Strain's NCBI accession fallback links", () => {
    const columns = new Map(
      strainMetadata.columns.map((column) => [column.id, column]),
    );

    expect(columns.get("1_pb2")?.valueHref).toBe(
      "https://www.ncbi.nlm.nih.gov/nuccore/{value}",
    );
    // A metadata link always wins over the fallback. Item 20B canonicalized
    // this from the stale `/view/Taxonomy/{value}` onto `/taxonomy/{value}`.
    expect(columns.get("taxon_id")?.valueHref).toBe("/taxonomy/{value}");
    expect(columns.get("genome_ids")?.valueHref).toBe("/genome/{value}");
    expect(columns.get("species")?.valueHref).toBeUndefined();
  });

  it("keeps Protein Feature's patric_id fallback and metadata links", () => {
    const columns = new Map(
      proteinFeatureMetadata.columns.map((column) => [column.id, column]),
    );

    expect(columns.get("patric_id")?.valueHref).toBe("/feature/{value}");
    expect(columns.get("patric_id")?.fallbackValue?.({ feature_id: "f.1" })).toBe(
      "f.1",
    );
    expect(columns.get("interpro_id")?.fallbackValue).toBeUndefined();
    expect(columns.get("id")?.valueHref).toBeUndefined();
  });

  it("leaves Protein Structure's pdb_id to the internal viewer link", () => {
    const pdbId = proteinStructureMetadata.columns.find(
      (column) => column.id === "pdb_id",
    );

    expect(pdbId?.valueHref).toBeUndefined();
  });
});

describe("child-resource columns", () => {
  const childCases: [string, DataResource, readonly { id: string; sortable?: boolean }[]][] =
    [
      ["feature", "genome_feature", childFeatureColumns],
      ["genome sequence", "genome_sequence", genomeSequenceColumns],
      ["interaction", "ppi", interactionColumns],
      ["sequence feature", "sequence_feature", sequenceFeatureColumns],
    ];

  it.each(childCases)(
    "%s child columns offer a sortable header only where the Data API agrees",
    (_name, resource, columns) => {
      expect(columns.length).toBeGreaterThan(0);
      for (const column of columns) {
        expect(column.sortable).toBe(
          resourceRegistry[resource].fields[column.id].sortable,
        );
      }
    },
  );

  it("stops the Feature child tab offering a sort on GO terms", () => {
    // `go` is metadata-unsortable; child columns used to omit `sortable` entirely,
    // which DataTable reads as sortable.
    expect(childFeatureColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "go", sortable: false }),
      ]),
    );
  });

  it("keeps the Feature child tab's hidden columns, unlike the Feature collection", () => {
    expect(childFeatureColumns.map((column) => column.id)).toContain(
      "plfam_id",
    );
    expect(featureMetadata.columns.map((column) => column.id)).not.toContain(
      "plfam_id",
    );
  });
});
