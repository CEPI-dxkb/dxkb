import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { epitopeViewRecordSchema, type EpitopeViewRecord } from "./schema";

export const getEpitope = cache(async (epitopeId: string): Promise<EpitopeViewRecord | null> => {
  const repository = await createServerDataRepository();
  const result = await repository.member("epitope", {
    operation: "member",
    id: epitopeId,
  });
  return result.row ? epitopeViewRecordSchema.parse(result.row) : null;
});
