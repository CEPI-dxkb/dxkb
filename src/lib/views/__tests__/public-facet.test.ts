import { describe, expect, it } from "vitest";
import { booleanFilterValues } from "@/lib/data-api";
import { featureCollectionOptions } from "@/lib/feature-view";
import { featureMetadata } from "@/lib/feature-view/fields";
import { genomeAmrCollectionProfile } from "@/lib/genome-amr-view";
import { genomeMetadata } from "@/lib/genome-view/fields";
import { genomeCollectionOptions } from "@/lib/genome-view/query";
import { strainMetadata } from "@/lib/strain-view/fields";
import { strainCollectionOptions } from "@/lib/strain-view/query";
import { parseCollectionState } from "@/lib/views/collection-state";
import { childCollectionOptions } from "@/lib/views/child-collection-state";
import { genomeSequenceCollectionProfile } from "@/lib/views/child-resources";

// Every table whose Solr core carries `public` offers it as a facet, as legacy
// BV-BRC's AdvancedSearchFields does (Strain, which legacy does not facet on,
// gets it collapsed).
describe("Public facet", () => {
  it.each([
    ["genome", genomeMetadata.facets, true],
    ["genome_feature", featureMetadata.facets, true],
    ["genome_amr", genomeAmrCollectionProfile.facets ?? [], true],
    ["genome_sequence", genomeSequenceCollectionProfile.facets ?? [], false],
    ["strain", strainMetadata.facets, false],
  ] as const)("is a %s facet", (_resource, facets, initiallyVisible) => {
    expect(facets.find((facet) => facet.field === "public")).toEqual({
      field: "public",
      label: "Public",
      initiallyVisible,
    });
  });

  it.each([
    ["genome", genomeCollectionOptions],
    ["genome_feature", featureCollectionOptions],
    ["strain", strainCollectionOptions],
    [
      "child tables",
      childCollectionOptions(
        genomeSequenceCollectionProfile.columns,
        genomeSequenceCollectionProfile.facets,
        "sequence_id:asc",
      ),
    ],
  ] as const)("is a %s URL filter limited to true/false", (_name, options) => {
    expect(options.friendlyFilters).toContain("public");
    expect(
      parseCollectionState({ public: ["true", "yes"] }, options).filters.public,
    ).toEqual(["true"]);
  });

  it("restricts only boolean fields", () => {
    expect(booleanFilterValues(["public", "genome_status"])).toEqual({
      public: ["true", "false"],
    });
  });
});
