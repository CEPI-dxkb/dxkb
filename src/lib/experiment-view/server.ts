import { cache } from "react";
import { readSession } from "@/lib/auth/server/session";
import { ServerDataRepository } from "@/lib/data-api/repository";
import {
  experimentViewRecordSchema,
  type ExperimentViewRecord,
} from "./schema";

export const getExperiment = cache(
  async (experimentId: string): Promise<ExperimentViewRecord | null> => {
    const session = await readSession();
    const baseUrl = process.env.DATA_API_URL ?? process.env.NEXT_PUBLIC_DATA_API;
    if (!baseUrl) throw new Error("DATA_API_URL is not configured.");
    const bypassCache = Boolean(session) || process.env.E2E_MOCK_ENABLED === "1";
    const repository = new ServerDataRepository({
      baseUrl,
      token: session?.token,
      cache: bypassCache ? "no-store" : "force-cache",
      revalidate: bypassCache ? undefined : 300,
    });
    const result = await repository.member("experiment", {
      operation: "member",
      id: experimentId,
    });
    return result.row ? experimentViewRecordSchema.parse(result.row) : null;
  },
);
