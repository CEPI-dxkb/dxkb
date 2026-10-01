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

  // A bare name carries no realm, and the browser would list it under the
  // `@bvbrc` default. Send the current user's own bare name (an old link or
  // bookmark) to the qualified owner, which is `@patricbrc.org` for legacy
  // PATRIC accounts.
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
