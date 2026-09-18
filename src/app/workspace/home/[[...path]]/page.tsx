import { redirect } from "next/navigation";
import { requireAuthSessionOrRedirect } from "@/lib/auth/server/route";
import { encodeWorkspaceSegment } from "@/lib/services/workspace/path-utils";
import { readRouteParamSegments } from "@/lib/views/route-params";

export default async function WorkspaceHomeRedirect({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  // A page component's catch-all segments arrive percent-encoded, so they
  // have to be read back before `encodeWorkspaceSegment` re-encodes them —
  // otherwise the redirect target is doubly encoded and the destination
  // page's single decode lands one level short. See `readRouteParam`.
  const encodedPath = readRouteParamSegments(path, "page")
    .map(encodeWorkspaceSegment)
    .join("/");
  const pathPart = encodedPath ? `/${encodedPath}` : "";
  const requestedPath = `/workspace/home${pathPart}`;
  const { userId } = await requireAuthSessionOrRedirect(requestedPath);
  redirect(`/workspace/${encodeWorkspaceSegment(userId)}/home${pathPart}`);
}
