import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotBadRequest } from "@/lib/copilot/route-errors";
import {
  copilotPlanSchema,
  editCopilotPlan,
  isCopilotId,
} from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ sessionId: string; planId: string }>;
}

const bodySchema = z.object({ plan: copilotPlanSchema });

/** Saves the whole plan object; the plan in the body must be the one the path names. */
export const PUT = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { sessionId, planId } = await params;
    if (!isCopilotId(sessionId) || !isCopilotId(planId)) {
      return copilotBadRequest("Invalid session or plan id.");
    }
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success || body.data.plan.plan_id !== planId) {
      return copilotBadRequest("Invalid plan.");
    }
    return answerCopilot(async () => {
      await editCopilotPlan(token, sessionId, planId, body.data.plan);
      return new NextResponse(null, { status: 204 });
    });
  },
);
