import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import {
  featureViewRecordSchema,
  isPatricFeatureId,
  type FeatureViewRecord,
} from "./schema";

export interface FeatureLookup {
  feature: FeatureViewRecord | null;
  usedAlternateId: boolean;
}

export const getFeature = cache(async (featureId: string): Promise<FeatureLookup> => {
  const repository = await createServerDataRepository();
  const usedAlternateId = isPatricFeatureId(featureId);
  const result = await repository.member("genome_feature", {
    operation: "member",
    id: featureId,
    idField: usedAlternateId ? "patric_id" : "feature_id",
  });
  return {
    feature: result.row ? featureViewRecordSchema.parse(result.row) : null,
    usedAlternateId,
  };
});
