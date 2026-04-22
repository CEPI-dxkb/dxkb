"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/hooks";
import { encodeWorkspaceSegment } from "@/lib/utils";

/**
 * Redirects /workspace/shared and /workspace/shared/[...path] to
 * /workspace/${username} and /workspace/${username}/[...path].
 */
export default function WorkspaceSharedRedirect() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const pathSegments = useMemo(
    () => (params.path as string[] | undefined) ?? [],
    [params.path]
  );
  const pathKey = pathSegments.join("/");

  useEffect(() => {
    const username = user?.username;
    if (!username) return;
    const encodedPath = pathSegments.map(encodeWorkspaceSegment).join("/");
    const pathPart = encodedPath ? `/${encodedPath}` : "";
    router.replace(`/workspace/${encodeWorkspaceSegment(username)}${pathPart}`);
  }, [router, user?.username, pathKey, pathSegments]);

  return null;
}
