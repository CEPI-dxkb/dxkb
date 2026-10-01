import { redirect } from "next/navigation";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import {
  encodeWorkspaceSegment,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";

export default async function WorkspacePage() {
  const user = await requireCurrentUserOrRedirect("/workspace");
  redirect(`/workspace/${encodeWorkspaceSegment(workspaceUsername(user))}/home`);
}
