"use client";

import { useStorageItem } from "@/hooks/use-storage-item";
import {
  parseRecentFolders,
  recentWorkspaceFoldersStorageKey,
  type RecentFolder,
} from "@/lib/recent-workspace-folders";

/** Recently visited folders for a signed-in user; empty on the server and when signed out. */
export function useRecentWorkspaceFolders(
  userPrefix: string | undefined,
): RecentFolder[] {
  const raw = useStorageItem(recentWorkspaceFoldersStorageKey);
  return userPrefix ? parseRecentFolders(raw, userPrefix) : [];
}
