import { redirect } from "next/navigation";
import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { getAuthToken } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";
import { encodeWorkspaceSegment } from "@/lib/utils";

interface WorkspaceUsernamePageProps {
  params: Promise<{ username: string }>;
}

/**
 * /workspace/[username] -> shared workspaces root (all folders: yours + shared with you).
 * Data is fetched on the client so requests appear in the browser Network tab.
 */
export default async function WorkspaceUsernamePage({ params }: WorkspaceUsernamePageProps) {
  const resolved = await params;
  const username = decodeURIComponent(resolved.username);
  if (!username) {
    redirect("/workspace/home");
  }

  const authToken = await getAuthToken();
  if (!authToken) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/workspace/${encodeWorkspaceSegment(username)}`)}`);
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
