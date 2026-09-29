import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import { getRequiredEnv } from "@/lib/env";
import { safeDecode } from "@/lib/url";

interface PublicWorkspacePathPageProps {
  params: Promise<{ username: string; path: string[] }>;
}

export default async function PublicWorkspacePathPage({
  params,
}: PublicWorkspacePathPageProps) {
  await requireCurrentUserOrRedirect("/workspace/public");
  const resolved = await params;
  const username = safeDecode(resolved.username);
  const segments = resolved.path.map((s) => safeDecode(s));
  const fullPath = `${username}/${segments.join("/")}`;
  const workspaceGuideUrl = getRequiredEnv("WORKSPACE_GUIDE_URL");

  return (
    <WorkspaceBrowser
      key={`public-path-${fullPath}`}
      mode="public"
      username={username}
      path={fullPath}
      workspaceGuideUrl={workspaceGuideUrl}
    />
  );
}
