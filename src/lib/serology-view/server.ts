import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import type { ServerDataRepository } from "@/lib/data-api/repository";
import { resolveCompoundSample } from "@/lib/views/compound-sample";
import { serologyViewRecordSchema, type SerologyViewRecord } from "./schema";

export type SerologyLookup =
  | { status: "unique"; record: SerologyViewRecord }
  | { status: "not-found" }
  | { status: "ambiguous"; testTypes: string[] };

type SerologyCollectionRepository = Pick<ServerDataRepository, "collection">;

export async function resolveSerology(
  repository: SerologyCollectionRepository,
  sampleIdentifier: string,
  testType?: string,
): Promise<SerologyLookup> {
  const result = await resolveCompoundSample(repository, {
    resource: "serology",
    sampleIdentifier,
    discriminatorField: "test_type",
    discriminator: testType,
    parseRecord: (row) => serologyViewRecordSchema.parse(row),
  });
  return result.status === "ambiguous"
    ? { status: "ambiguous", testTypes: result.discriminatorValues }
    : result;
}

export const getSerology = cache(
  async (
    sampleIdentifier: string,
    testType?: string,
  ): Promise<SerologyLookup> => {
    const repository = await createServerDataRepository();
    return resolveSerology(repository, sampleIdentifier, testType);
  },
);
