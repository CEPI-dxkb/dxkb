import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import {
  answerCopilot,
  copilotBadRequest,
  copilotNoStore,
} from "@/lib/copilot/route-errors";
import {
  deleteCopilotSession,
  isCopilotId,
  maxCopilotTitleLength,
  readCopilotSession,
  renameCopilotSession,
  setCopilotExecutionMode,
} from "@/lib/copilot/server";
import type { CopilotSessionDetail } from "@/lib/copilot/types";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

async function sessionIdFrom(params: RouteParams["params"]) {
  const { sessionId } = await params;
  return isCopilotId(sessionId) ? sessionId : null;
}

export const GET = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const sessionId = await sessionIdFrom(params);
    if (!sessionId) return copilotBadRequest("Invalid session id.");
    return answerCopilot(async () =>
      NextResponse.json<CopilotSessionDetail>(
        await readCopilotSession(token, sessionId, request.signal),
        { headers: copilotNoStore },
      ),
    );
  },
);

const updateSchema = z.union([
  z.object({ title: z.string().trim().min(1).max(maxCopilotTitleLength) }),
  z.object({ executionMode: z.enum(["plan", "execute"]) }),
]);

export const PATCH = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const sessionId = await sessionIdFrom(params);
    if (!sessionId) return copilotBadRequest("Invalid session id.");
    const body = updateSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return copilotBadRequest("A title or an execution mode is required.");
    }
    const update = body.data;
    return answerCopilot(async () => {
      if ("title" in update) {
        await renameCopilotSession(token, sessionId, update.title);
      } else {
        await setCopilotExecutionMode(token, sessionId, update.executionMode);
      }
      return NextResponse.json(update);
    });
  },
);

export const DELETE = withAuth<RouteParams>(
  async (_request: NextRequest, { token, params }) => {
    const sessionId = await sessionIdFrom(params);
    if (!sessionId) return copilotBadRequest("Invalid session id.");
    return answerCopilot(async () => {
      await deleteCopilotSession(token, sessionId);
      return new NextResponse(null, { status: 204 });
    });
  },
);
