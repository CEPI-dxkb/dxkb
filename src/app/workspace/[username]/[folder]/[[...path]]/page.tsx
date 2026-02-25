import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { getRequiredEnv } from "@/lib/env";
import { safeDecode } from "@/lib/url";

interface WorkspaceFolderPageProps {
  params: Promise<{ username: string; folder: string; path?: string[] }>;
}

/**
 * /workspace/[username]/[folder]/[[...path]] -> shared folder contents.
 * [username] is the folder owner (e.g. jimdavis@patricbrc.org), path is owner/folder/...
 */
export default async function WorkspaceFolderPage({
  params,
}: WorkspaceFolderPageProps) {
  const resolved = await params;
  const username = safeDecode(resolved.username ?? "");
  const folder = safeDecode(resolved.folder ?? "");
  const segments = resolved.path ?? [];
  const rest = segments.map((s) => safeDecode(s)).join("/");
  const path = rest ? `${username}/${folder}/${rest}` : `${username}/${folder}`;
  const workspaceGuideUrl = getRequiredEnv("WORKSPACE_GUIDE_URL");

  return (
    <WorkspaceBrowser
      mode="shared"
      username={username}
      path={path}
      workspaceGuideUrl={workspaceGuideUrl}
    />
  );
}
