import { redirect } from "next/navigation";
import { requireAuthSessionOrRedirect } from "@/lib/auth/server/route";
import {
  encodeWorkspaceSegment,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";
import { readRouteParamSegments } from "@/lib/views/route-params";

export default async function WorkspaceHomeRedirect({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  // Catch-all segments arrive percent-encoded and must be read back before
  // `encodeWorkspaceSegment` re-encodes them, or the target is doubly encoded
  // (see `readRouteParam`).
  const encodedPath = readRouteParamSegments(path, "page")
    .map(encodeWorkspaceSegment)
    .join("/");
  const pathPart = encodedPath ? `/${encodedPath}` : "";
  const requestedPath = `/workspace/home${pathPart}`;
  const { userId, realm } = await requireAuthSessionOrRedirect(requestedPath);
  const owner = workspaceUsername({ username: userId, realm });
  redirect(`/workspace/${encodeWorkspaceSegment(owner)}/home${pathPart}`);
}
