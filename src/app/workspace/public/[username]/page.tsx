import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import { getRequiredEnv } from "@/lib/env";
import { safeDecode } from "@/lib/url";

interface PublicUserWorkspacesPageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicUserWorkspacesPage({
  params,
}: PublicUserWorkspacesPageProps) {
  await requireCurrentUserOrRedirect("/workspace/public");
  const { username: rawUsername } = await params;
  const username = safeDecode(rawUsername);
  const workspaceGuideUrl = getRequiredEnv("WORKSPACE_GUIDE_URL");

  return (
    <WorkspaceBrowser
      key={`public-user-${username}`}
      mode="public"
      username={username}
      path={username}
      workspaceGuideUrl={workspaceGuideUrl}
    />
  );
}
