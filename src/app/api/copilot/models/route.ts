import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotNoStore } from "@/lib/copilot/route-errors";
import { readCopilotModels } from "@/lib/copilot/server";
import type { CopilotModelsResponse } from "@/lib/copilot/types";

export const GET = withAuth(async (request, { token }) =>
  answerCopilot(async () =>
    NextResponse.json<CopilotModelsResponse>(
      { models: await readCopilotModels(token, request.signal) },
      { headers: copilotNoStore },
    ),
  ),
);
