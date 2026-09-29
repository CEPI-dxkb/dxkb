import { redirect } from "next/navigation";
import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import { getRequiredEnv } from "@/lib/env";
import { readRouteParam } from "@/lib/views/route-params";

interface WorkspaceUsernamePageProps {
  params: Promise<{ username: string }>;
}

/**
 * /workspace/[username] -> shared workspaces root (all folders: yours + shared with you).
 * Data is fetched on the client so requests appear in the browser Network tab.
 */
export default async function WorkspaceUsernamePage({ params }: WorkspaceUsernamePageProps) {
  await requireCurrentUserOrRedirect("/workspace");
  const resolved = await params;
  const username = readRouteParam(resolved.username, "page");
  if (!username) {
    redirect("/workspace/home");
  }

  const workspaceGuideUrl = getRequiredEnv("WORKSPACE_GUIDE_URL");
  return (
    <WorkspaceBrowser
      key={`shared-${username}`}
      mode="shared"
      username={username}
      path=""
      workspaceGuideUrl={workspaceGuideUrl}
    />
  );
}
