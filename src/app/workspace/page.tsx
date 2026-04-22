"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/hooks";
import { encodeWorkspaceSegment } from "@/lib/utils";

export default function WorkspacePage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.username) {
      router.replace(`/workspace/${encodeWorkspaceSegment(user.username)}/home`);
    }
  }, [user?.username, router]);

  return null;
}
