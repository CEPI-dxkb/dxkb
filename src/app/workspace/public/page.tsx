import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { getRequiredEnv } from "@/lib/env";

export default function PublicWorkspacesPage() {
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
