import { describe, expect, it } from "vitest";
import {
  epitopeCollectionOptions,
  epitopeCollectionProfile,
} from "@/lib/epitope-view";
import {
  experimentCollectionOptions,
  experimentCollectionProfile,
} from "@/lib/experiment-view";
import {
  featureCollectionOptions,
  featureCollectionProfile,
  featureListCollectionOptions,
} from "@/lib/feature-view";
import {
  genomeCollectionOptions,
  genomeCollectionProfile,
} from "@/lib/genome-view";
import {
  proteinFeatureCollectionOptions,
  proteinFeatureCollectionProfile,
} from "@/lib/protein-feature-view";
import {
  proteinStructureCollectionOptions,
  proteinStructureCollectionProfile,
} from "@/lib/protein-structure-view";
import {
  serologyCollectionOptions,
  serologyCollectionProfile,
} from "@/lib/serology-view";
import {
  strainCollectionOptions,
  strainCollectionProfile,
} from "@/lib/strain-view";
import {
  surveillanceCollectionOptions,
  surveillanceCollectionProfile,
} from "@/lib/surveillance-view";
import {
  taxonomyCollectionOptions,
  taxonomyCollectionProfile,
} from "@/lib/taxonomy-view";
import type { CollectionStateOptions } from "@/lib/views/collection-state";

// Child collections (`ResourceChildCollection`) derive their filters from their
// facets (`child-collection-state.ts`), so only the top-level views are listed.
const views: [
  string,
  { facets?: readonly { field: string }[] },
  CollectionStateOptions,
][] = [
  ["epitope", epitopeCollectionProfile, epitopeCollectionOptions],
  ["experiment", experimentCollectionProfile, experimentCollectionOptions],
  ["feature", featureCollectionProfile, featureCollectionOptions],
  ["feature list", featureCollectionProfile, featureListCollectionOptions],
  ["genome", genomeCollectionProfile, genomeCollectionOptions],
  [
    "protein feature",
    proteinFeatureCollectionProfile,
    proteinFeatureCollectionOptions,
  ],
  [
    "protein structure",
    proteinStructureCollectionProfile,
    proteinStructureCollectionOptions,
  ],
  ["serology", serologyCollectionProfile, serologyCollectionOptions],
  ["strain", strainCollectionProfile, strainCollectionOptions],
  ["surveillance", surveillanceCollectionProfile, surveillanceCollectionOptions],
  ["taxonomy", taxonomyCollectionProfile, taxonomyCollectionOptions],
];

describe("collection facets", () => {
  // A facet the filters panel offers but `friendlyFilters` omits is dropped
  // when its pick is written to the URL: the value highlights, then clears.
  it.each(views)(
    "%s accepts a URL filter for every facet its panel offers",
    (_name, profile, options) => {
      const facets = (profile.facets ?? []).map((facet) => facet.field);
      expect(facets.length).toBeGreaterThan(0);
      const allowed = new Set(options.friendlyFilters ?? []);
      expect(facets.filter((field) => !allowed.has(field))).toEqual([]);
    },
  );
});
