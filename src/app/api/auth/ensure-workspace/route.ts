import { NextResponse } from "next/server";
import { statusToErrorCode } from "@/lib/api/types";
import {
  describeUpstreamFailure,
  upstreamServices,
} from "@/lib/api/upstream-failure";
import { withAuth } from "@/lib/auth/server/route";
import {
  ensureUserWorkspace,
  type EnsureUserWorkspaceResult,
} from "@/lib/services/workspace/setup";
import { createServerWorkspaceRpc } from "@/lib/services/workspace/server-rpc";
import { getDefaultRealm } from "@/lib/services/workspace/realm";
import { workspaceErrorMessage } from "@/lib/services/workspace/workspace-errors";

/** The reason shown when the Workspace's own reply carries no text. */
const setupFailed = "the workspace service returned an error";

/**
 * The answer when the home could not be checked: an outage keeps its
 * 502/503/504 and the cause; a Workspace error that does not mean "home is
 * missing" (a maintenance page, a JSON-RPC fault) is a 502 with its message.
 */
function checkFailedResponse(error: unknown): NextResponse {
  const failure = describeUpstreamFailure(error, upstreamServices.workspace);
  if (failure) {
    return NextResponse.json(
      { error: failure.message, code: statusToErrorCode(failure.status) },
      { status: failure.status },
    );
  }
  const reason = workspaceErrorMessage(error, setupFailed);
  return NextResponse.json(
    {
      error: `Couldn't check your workspace home folder: ${reason}`,
      code: "upstream",
    },
    { status: 502 },
  );
}

/**
 * Some folders could not be created: report it, never as success. The
 * reasons are the Workspace's raw replies ("_ERROR_Quota exceeded_ERROR_"),
 * which the log keeps; the response carries their condensed text.
 */
function incompleteResponse(result: EnsureUserWorkspaceResult): NextResponse {
  const failures = Object.fromEntries(
    Object.entries(result.failures).map(([path, reason]) => [
      path,
      workspaceErrorMessage({ message: reason }, setupFailed),
    ]),
  );
  const failed = Object.entries(failures);
  const [firstPath, firstReason] = failed[0];
  const others =
    failed.length > 1 ? ` (and ${String(failed.length - 1)} more)` : "";
  return NextResponse.json(
    {
      error: `Couldn't create ${firstPath}${others}: ${firstReason}`,
      code: "upstream",
      created: result.created,
      failures,
    },
    { status: 502 },
  );
}

export const POST = withAuth(async (_request, { token, userId, realm }) => {
  let result: EnsureUserWorkspaceResult;
  try {
    result = await ensureUserWorkspace({
      rpc: createServerWorkspaceRpc(token),
      userId,
      realm: realm ?? getDefaultRealm(),
    });
  } catch (error) {
    console.error("Ensure workspace: checking the home folder failed:", error);
    return checkFailedResponse(error);
  }
  if (Object.keys(result.failures).length > 0) {
    console.error("Ensure workspace: setup incomplete:", result.failures);
    return incompleteResponse(result);
  }
  return NextResponse.json({ success: true, ...result });
});
