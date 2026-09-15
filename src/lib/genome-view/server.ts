import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { genomeViewRecordSchema, type GenomeViewRecord } from "./schema";

export const getGenome = cache(
  async (genomeId: string): Promise<GenomeViewRecord | null> => {
    const repository = await createServerDataRepository();
    const result = await repository.member("genome", {
      operation: "member",
      id: genomeId,
    });
    return result.row ? genomeViewRecordSchema.parse(result.row) : null;
  },
);
