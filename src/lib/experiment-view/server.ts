import { cache } from "react";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import {
  experimentViewRecordSchema,
  type ExperimentViewRecord,
} from "./schema";

export const getExperiment = cache(
  async (experimentId: string): Promise<ExperimentViewRecord | null> => {
    const repository = await createServerDataRepository();
    const result = await repository.member("experiment", {
      operation: "member",
      id: experimentId,
    });
    return result.row ? experimentViewRecordSchema.parse(result.row) : null;
  },
);
