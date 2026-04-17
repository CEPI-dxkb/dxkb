import { normalizeToArray } from "@/lib/rerun-utility";
import { createServiceDefinition } from "@/lib/services/service-definition";

import {
  defaultProteomeComparisonFormValues,
  proteomeComparisonFormSchema,
  type ComparisonItem,
  type ProteomeComparisonFormData,
} from "./proteome-comparison-form-schema";
import {
  createFastaComparisonItem,
  createFeatureGroupComparisonItem,
  createGenomeComparisonItem,
  transformProteomeComparisonParams,
} from "./proteome-comparison-form-utils";

export const proteomeComparisonService =
  createServiceDefinition<ProteomeComparisonFormData>({
    serviceName: "GenomeComparison",
    displayName: "Proteome Comparison",
    schema: proteomeComparisonFormSchema,
    defaultValues: defaultProteomeComparisonFormValues,
    transformParams: transformProteomeComparisonParams,
    rerun: {
      fields: ["output_path", "output_file", "max_e_val"],
      onApply: (rerunData, form) => {
        if (typeof rerunData.min_seq_cov === "number") {
          form.setFieldValue(
            "min_seq_cov",
            Math.round(rerunData.min_seq_cov * 100) as never,
          );
        }
        if (typeof rerunData.min_ident === "number") {
          form.setFieldValue(
            "min_ident",
            Math.round(rerunData.min_ident * 100) as never,
          );
        }

        const genomeIds = normalizeToArray<string>(rerunData.genome_ids);
        const userGenomes = normalizeToArray<string>(rerunData.user_genomes);
        const userFeatureGroups = normalizeToArray<string>(
          rerunData.user_feature_groups,
        );
        const refIndex =
          typeof rerunData.reference_genome_index === "number"
            ? rerunData.reference_genome_index
            : 0;

        const refIsGenome = refIndex >= 1 && refIndex <= genomeIds.length;
        const refIsFasta =
          refIndex > genomeIds.length &&
          refIndex <= genomeIds.length + userGenomes.length;
        const refIsFeatureGroup =
          refIndex > genomeIds.length + userGenomes.length &&
          refIndex <=
            genomeIds.length + userGenomes.length + userFeatureGroups.length;

        if (refIsGenome && genomeIds.length > 0) {
          const refGenomeId = genomeIds[refIndex - 1];
          form.setFieldValue("ref_genome_id", refGenomeId as never);
          form.setFieldValue("ref_source_type", "genome" as never);
        } else if (refIsFasta && userGenomes.length > 0) {
          const refFastaIndex = refIndex - genomeIds.length - 1;
          form.setFieldValue(
            "ref_fasta_file",
            userGenomes[refFastaIndex] as never,
          );
          form.setFieldValue("ref_source_type", "fasta" as never);
        } else if (refIsFeatureGroup && userFeatureGroups.length > 0) {
          const refFgIndex =
            refIndex - genomeIds.length - userGenomes.length - 1;
          form.setFieldValue(
            "ref_feature_group",
            userFeatureGroups[refFgIndex] as never,
          );
          form.setFieldValue("ref_source_type", "feature_group" as never);
        }

        const compItems: ComparisonItem[] = [];

        genomeIds.forEach((gid, idx) => {
          if (refIsGenome && idx === refIndex - 1) return;
          compItems.push(createGenomeComparisonItem(gid, gid));
        });

        userGenomes.forEach((path, idx) => {
          if (refIsFasta && idx === refIndex - genomeIds.length - 1) return;
          compItems.push(createFastaComparisonItem(path));
        });

        userFeatureGroups.forEach((path, idx) => {
          if (
            refIsFeatureGroup &&
            idx === refIndex - genomeIds.length - userGenomes.length - 1
          ) {
            return;
          }
          compItems.push(createFeatureGroupComparisonItem(path));
        });

        if (compItems.length > 0) {
          form.setFieldValue("comparison_items", compItems as never);
        }
      },
    },
  });
