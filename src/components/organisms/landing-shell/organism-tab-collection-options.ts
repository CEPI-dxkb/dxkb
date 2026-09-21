import { epitopeCollectionOptions } from "@/lib/epitope-view";
import { experimentCollectionOptions } from "@/lib/experiment-view";
import { featureCollectionOptions } from "@/lib/feature-view";
import { genomeCollectionOptions } from "@/lib/genome-view";
import { proteinFeatureCollectionOptions } from "@/lib/protein-feature-view";
import { proteinStructureCollectionOptions } from "@/lib/protein-structure-view";
import { serologyCollectionOptions } from "@/lib/serology-view";
import { strainCollectionOptions } from "@/lib/strain-view";
import { surveillanceCollectionOptions } from "@/lib/surveillance-view";
import type { CollectionStateOptions } from "@/lib/views/collection-state";
import type { OrganismViewKey } from "@/components/organisms/types";

/** Collection-state options for every organism tab, including non-collection tabs. */
export const organismTabCollectionOptionsByView: Record<
  OrganismViewKey,
  CollectionStateOptions | null
> = {
  overview: null,
  phylogeny: null,
  "taxa-tree": null,
  genomes: genomeCollectionOptions,
  sequences: null,
  features: featureCollectionOptions,
  "protein-structures": proteinStructureCollectionOptions,
  "domains-and-motifs": proteinFeatureCollectionOptions,
  epitopes: epitopeCollectionOptions,
  experiments: experimentCollectionOptions,
  interactions: null,
  strains: strainCollectionOptions,
  surveillance: surveillanceCollectionOptions,
  serology: serologyCollectionOptions,
  sfvt: null,
};

export const organismTabCollectionOptions = Object.values(
  organismTabCollectionOptionsByView,
).filter((options): options is CollectionStateOptions => options !== null);
