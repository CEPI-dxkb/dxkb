import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server/instance";
import { ensureUserWorkspace } from "@/lib/services/workspace/setup";
import { createServerWorkspaceRpc } from "@/lib/services/workspace/server-rpc";
import { getDefaultRealm } from "@/lib/services/workspace/realm";

export const POST = auth.route(async (_request, { token, userId, realm }) => {
  try {
    const result = await ensureUserWorkspace({
      rpc: createServerWorkspaceRpc(token),
      userId,
      realm: realm ?? getDefaultRealm(),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Workspace setup failed";
    return NextResponse.json({ message }, { status: 500 });
  }
});
