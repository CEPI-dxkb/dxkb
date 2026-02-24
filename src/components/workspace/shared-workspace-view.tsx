"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { encodeWorkspaceSegment } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  useSharedWithUser,
  useUserWorkspaces,
  useWorkspaceListByPath,
  useWorkspaceGet,
  useWorkspacePermissions,
} from "@/hooks/services/workspace/use-shared-with-user";
import type { ListPermissionsResult } from "@/lib/services/workspace/shared";
import { WorkspaceBreadcrumbs } from "@/components/workspace/workspace-breadcrumbs";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { WorkspaceDataTable } from "@/components/workspace/workspace-data-table";
import { isFolderType } from "@/components/workspace/workspace-item-icon";
import {
  WorkspaceBrowserItem,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";
import { Skeleton } from "@/components/ui/skeleton";

interface SharedWorkspaceViewProps {
  username: string;
  path: string;
  initialSharedItems?: WorkspaceBrowserItem[];
  initialPathItems?: WorkspaceBrowserItem[];
  initialPermissions?: ListPermissionsResult;
}

function sortItems(
  items: WorkspaceBrowserItem[],
  sort: WorkspaceBrowserSort,
): WorkspaceBrowserItem[] {
  return [...items].sort((a, b) => {
    const aIsFolder = isFolderType(a.type);
    const bIsFolder = isFolderType(b.type);
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

    let comparison = 0;
    switch (sort.field) {
      case "name":
        comparison = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
        break;
      case "size":
        comparison = (a.size ?? 0) - (b.size ?? 0);
        break;
      case "owner_id":
        comparison = (a.owner_id ?? "").localeCompare(b.owner_id ?? "");
        break;
      case "creation_time":
        comparison = (a.timestamp ?? 0) - (b.timestamp ?? 0);
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      default:
        comparison = 0;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function SharedWorkspaceView({
  username,
  path,
  initialSharedItems,
  initialPathItems,
  initialPermissions,
}: SharedWorkspaceViewProps) {
  const { user } = useAuth();
  const currentUsername = user?.username ?? "";
  const fullWorkspaceUsername =
    (user?.realm ? `${user.username}@${user.realm}` : null) ?? user?.username ?? "";
  const myWorkspaceRoot = fullWorkspaceUsername || currentUsername;
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAuthChecked(true), 800);
    return () => clearTimeout(t);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });

  const isAtSharedRoot = !path || path === "";
  const fullPath = path ? `/${path}` : "";

  const isUrlCurrentUser =
    username === currentUsername ||
    username === fullWorkspaceUsername ||
    username === myWorkspaceRoot ||
    (currentUsername && username.startsWith(`${currentUsername}@`));
  useEffect(() => {
    if (!isAtSharedRoot || !myWorkspaceRoot || isUrlCurrentUser) return;
    router.replace(`/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}`);
  }, [isAtSharedRoot, myWorkspaceRoot, isUrlCurrentUser, username, router]);

  const sharedQuery = useSharedWithUser({
    username: currentUsername,
    enabled: isAtSharedRoot && !!currentUsername,
    initialData: isAtSharedRoot ? initialSharedItems : undefined,
  });

  const userWorkspacesQuery = useUserWorkspaces({
    username: currentUsername,
    enabled: isAtSharedRoot && !!currentUsername,
  });

  const pathQuery = useWorkspaceListByPath({
    fullPath,
    enabled: !isAtSharedRoot && !!fullPath,
    initialData: !isAtSharedRoot ? initialPathItems : undefined,
  });

  useWorkspaceGet({
    objectPaths: !isAtSharedRoot && fullPath ? [fullPath] : [],
    enabled: !isAtSharedRoot && !!fullPath,
  });

  const rootItems = useMemo(() => {
    if (!isAtSharedRoot) return [];
    const shared = sharedQuery.data ?? [];
    const user = userWorkspacesQuery.data ?? [];
    const byPath = new Map<string, WorkspaceBrowserItem>();
    for (const item of [...user, ...shared]) {
      if (!byPath.has(item.path)) byPath.set(item.path, item);
    }
    return Array.from(byPath.values());
  }, [isAtSharedRoot, sharedQuery.data, userWorkspacesQuery.data]);

  const items = isAtSharedRoot ? rootItems : pathQuery.data ?? [];
  const itemPaths = useMemo(() => items.map((i) => i.path), [items]);
  const permissionsQuery = useWorkspacePermissions({
    paths: itemPaths,
    enabled: itemPaths.length > 0,
    initialData: initialPermissions,
  });

  const memberCountByPath = useMemo(() => {
    const perms = permissionsQuery.data;
    if (!perms) return undefined;
    const out: Record<string, number> = {};
    for (const pathEntry of itemPaths) {
      const list = perms[pathEntry];
      out[pathEntry] = Array.isArray(list) ? list.length : 0;
    }
    return out;
  }, [permissionsQuery.data, itemPaths]);

  const isLoading = isAtSharedRoot
    ? sharedQuery.isLoading || userWorkspacesQuery.isLoading
    : pathQuery.isLoading;
  const error = isAtSharedRoot
    ? sharedQuery.error ?? userWorkspacesQuery.error
    : pathQuery.error;
  const refetch = isAtSharedRoot
    ? () => {
        void sharedQuery.refetch();
        void userWorkspacesQuery.refetch();
      }
    : pathQuery.refetch;
  const isFetching = isAtSharedRoot
    ? sharedQuery.isFetching || userWorkspacesQuery.isFetching
    : pathQuery.isFetching;

  const processedItems = useMemo(() => {
    let filtered = items;

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name?.toLowerCase().includes(query),
      );
    }

    return sortItems(filtered, sort);
  }, [items, typeFilter, searchQuery, sort]);

  if (!currentUsername) {
    if (!authChecked) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="rounded-md border">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      );
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You must be signed in to access the workspace.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <WorkspaceBreadcrumbs
        path={path}
        username={username}
        itemCount={items.length}
        viewMode={path ? "shared" : "root"}
        currentUsername={currentUsername}
        workspaceRootUsername={myWorkspaceRoot}
      />

      <WorkspaceToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load shared folders: {error.message}
          </AlertDescription>
        </Alert>
      )}

      <WorkspaceDataTable
        items={processedItems}
        isLoading={isLoading}
        path={path}
        sort={sort}
        onSortChange={setSort}
        viewMode="shared"
        username={username}
        sharedRootUsername={myWorkspaceRoot}
        memberCountByPath={memberCountByPath}
      />
    </div>
  );
}
