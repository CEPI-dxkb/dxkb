import { redirect } from "next/navigation";
import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import { getRequiredEnv } from "@/lib/env";
import {
  encodeWorkspaceSegment,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";
import { safeDecode } from "@/lib/url";

interface WorkspaceHomePageProps {
  params: Promise<{ username?: string; path?: string[] }>;
}

export default async function WorkspaceHomePage({ params }: WorkspaceHomePageProps) {
  const user = await requireCurrentUserOrRedirect("/workspace");
  const resolved = await params;
  const username = safeDecode(resolved.username ?? "");
  const segments = resolved.path ?? [];
  const decodedSegments = segments.map((s) => safeDecode(s));
  const decodedPath = decodedSegments.join("/");

  if (!username) {
    redirect("/workspace/home");
  }

  // A bare name carries no realm and would list under the `@bvbrc` default;
  // redirect the current user's own bare name to the qualified owner
  // (`@patricbrc.org` for legacy accounts).
  const owner = workspaceUsername(user);
  if (
    !username.includes("@") &&
    owner !== username &&
    (username === user.username || username === user.id)
  ) {
    const pathPart = decodedSegments
      .map((s) => `/${encodeWorkspaceSegment(s)}`)
      .join("");
    redirect(`/workspace/${encodeWorkspaceSegment(owner)}/home${pathPart}`);
  }

  const workspaceGuideUrl = getRequiredEnv("WORKSPACE_GUIDE_URL");
  return (
    <WorkspaceBrowser
      key={`home-${decodedPath}`}
      mode="home"
      username={username}
      path={decodedPath}
      workspaceGuideUrl={workspaceGuideUrl}
    />
  );
}
