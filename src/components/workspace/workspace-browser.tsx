"use client";

import { useState, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useWorkspaceBrowser } from "@/hooks/services/workspace/use-workspace-browser";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { WorkspaceDataTable } from "./workspace-data-table";
import { isFolderType } from "./workspace-item-icon";
import {
  WorkspaceBrowserItem,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";

interface WorkspaceBrowserProps {
  /** Username from URL segment (e.g. workspace/chrescobar/home) */
  username: string;
  path: string;
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

export function WorkspaceBrowser({ username, path }: WorkspaceBrowserProps) {
  const { user } = useAuth();
  const currentUser = user?.username ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });

  const {
    data: items = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useWorkspaceBrowser({ username: currentUser, path });

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

  if (!currentUser) {
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
            Failed to load workspace contents: {error.message}
          </AlertDescription>
        </Alert>
      )}

      <WorkspaceDataTable
        items={processedItems}
        isLoading={isLoading}
        path={path}
        sort={sort}
        onSortChange={setSort}
        showViewSharedRow={!path || path === "" || path === "/" || !path.trim()}
        viewMode="home"
        username={username}
      />
    </div>
  );
}
