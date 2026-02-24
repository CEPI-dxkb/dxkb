"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { encodeWorkspaceSegment } from "@/lib/utils";

/**
 * Redirects /workspace/home and /workspace/home/[...path] to
 * /workspace/${username}/home and /workspace/${username}/home/[...path].
 */
export default function WorkspaceHomeRedirect() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const pathSegments = (params.path as string[] | undefined) ?? [];

  useEffect(() => {
    const username = user?.username;
    if (!username) return;
    const encodedPath = pathSegments.map(encodeWorkspaceSegment).join("/");
    const pathPart = encodedPath ? `/${encodedPath}` : "";
    router.replace(`/workspace/${encodeWorkspaceSegment(username)}/home${pathPart}`);
  }, [router, user?.username, pathSegments.join("/")]);

  return null;
}
