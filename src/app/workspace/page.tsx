import { redirect } from "next/navigation";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";

export default async function WorkspacePage() {
  const { id: userId } = await requireCurrentUserOrRedirect("/workspace");
  redirect(`/workspace/${encodeWorkspaceSegment(userId)}/home`);
}
