import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import type { ServerDataRepository } from "@/lib/data-api/repository";
import { resolveCompoundSample } from "@/lib/views/compound-sample";
import {
  surveillanceViewRecordSchema,
  type SurveillanceViewRecord,
} from "./schema";

export type SurveillanceLookup =
  | { status: "unique"; record: SurveillanceViewRecord }
  | { status: "not-found" }
  | { status: "ambiguous"; testTypes: string[] };

type SurveillanceCollectionRepository = Pick<
  ServerDataRepository,
  "collection"
>;

export async function resolveSurveillance(
  repository: SurveillanceCollectionRepository,
  sampleIdentifier: string,
  pathogenTestType?: string,
): Promise<SurveillanceLookup> {
  const result = await resolveCompoundSample(repository, {
    resource: "surveillance",
    sampleIdentifier,
    discriminatorField: "pathogen_test_type",
    discriminator: pathogenTestType,
    parseRecord: (row) => surveillanceViewRecordSchema.parse(row),
  });
  return result.status === "ambiguous"
    ? { status: "ambiguous", testTypes: result.discriminatorValues }
    : result;
}

export const getSurveillance = cache(
  async (
    sampleIdentifier: string,
    pathogenTestType?: string,
  ): Promise<SurveillanceLookup> => {
    const repository = await createServerDataRepository({ readScope: "query" });
    return resolveSurveillance(repository, sampleIdentifier, pathogenTestType);
  },
);
