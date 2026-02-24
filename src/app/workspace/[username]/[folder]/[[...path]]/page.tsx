import { SharedWorkspaceView } from "@/components/workspace/shared-workspace-view";

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
  const username = decodeURIComponent(resolved.username ?? "");
  const folder = decodeURIComponent(resolved.folder ?? "");
  const segments = resolved.path ?? [];
  const rest = segments.map((s) => decodeURIComponent(s)).join("/");
  const path = rest ? `${username}/${folder}/${rest}` : `${username}/${folder}`;

  return <SharedWorkspaceView username={username} path={path} />;
}
