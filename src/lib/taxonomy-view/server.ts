import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { taxonomyViewRecordSchema, type TaxonomyViewRecord } from "./schema";

export const getTaxonomy = cache(
  async (taxonId: string): Promise<TaxonomyViewRecord | null> => {
    const repository = await createServerDataRepository({ readScope: "member" });
    const result = await repository.member("taxonomy", {
      operation: "member",
      id: taxonId,
    });
    return result.row ? taxonomyViewRecordSchema.parse(result.row) : null;
  },
);
