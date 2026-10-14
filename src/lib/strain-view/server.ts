import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { strainViewRecordSchema, type StrainViewRecord } from "./schema";

export const getStrain = cache(
  async (strainId: string): Promise<StrainViewRecord | null> => {
    const repository = await createServerDataRepository({ readScope: "member" });
    const result = await repository.member("strain", {
      operation: "member",
      id: strainId,
    });
    return result.row ? strainViewRecordSchema.parse(result.row) : null;
  },
);
