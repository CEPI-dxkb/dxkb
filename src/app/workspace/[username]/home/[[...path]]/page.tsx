import { redirect } from "next/navigation";
import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";

interface WorkspaceHomePageProps {
  params: Promise<{ username?: string; path?: string[] }>;
}

export default async function WorkspaceHomePage({ params }: WorkspaceHomePageProps) {
  const resolved = await params;
  const username = resolved.username ?? "";
  const segments = resolved.path ?? [];
  const decodedPath = segments.map((s) => decodeURIComponent(s)).join("/");

  if (!username) {
    redirect("/workspace/home");
  }

  return <WorkspaceBrowser username={username} path={decodedPath} />;
}
