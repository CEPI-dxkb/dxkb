"use client";

import { useStorageItem } from "@/hooks/use-storage-item";
import {
  parseRecentFolders,
  recentWorkspaceFoldersStorageKey,
  type RecentFolder,
} from "@/lib/recent-workspace-folders";

export function useRecentWorkspaceFolders(
  userPrefix: string | undefined,
): RecentFolder[] {
  const raw = useStorageItem(recentWorkspaceFoldersStorageKey);
  return userPrefix ? parseRecentFolders(raw, userPrefix) : [];
}
