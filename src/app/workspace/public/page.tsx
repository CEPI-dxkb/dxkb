import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import { getRequiredEnv } from "@/lib/env";

export default async function PublicWorkspacesPage() {
  await requireCurrentUserOrRedirect("/workspace/public");
  const workspaceGuideUrl = getRequiredEnv("WORKSPACE_GUIDE_URL");

  return (
    <WorkspaceBrowser
      key="public-root"
      mode="public"
      username=""
      path=""
      workspaceGuideUrl={workspaceGuideUrl}
    />
  );
}
