import { redirect } from "next/navigation";
import { SharedWorkspaceView } from "@/components/workspace/shared-workspace-view";
import { getBvbrcAuthToken } from "@/lib/auth";
import { encodeWorkspaceSegment } from "@/lib/utils";

interface WorkspaceUsernamePageProps {
  params: Promise<{ username?: string }>;
}

/**
 * /workspace/[username] -> shared workspaces root (all folders: yours + shared with you).
 * Data is fetched on the client so requests appear in the browser Network tab.
 */
export default async function WorkspaceUsernamePage({ params }: WorkspaceUsernamePageProps) {
  const resolved = await params;
  const username = decodeURIComponent(resolved.username ?? "");
  if (!username) {
    redirect("/workspace/home");
  }

  const authToken = await getBvbrcAuthToken();
  if (!authToken) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/workspace/${encodeWorkspaceSegment(username)}`)}`);
  }

  return <SharedWorkspaceView username={username} path="" />;
}
