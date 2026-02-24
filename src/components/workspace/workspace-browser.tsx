"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useWorkspaceBrowser } from "@/hooks/services/workspace/use-workspace-browser";
import {
  useSharedWithUser,
  useUserWorkspaces,
  useWorkspaceListByPath,
  useWorkspaceGet,
  useWorkspacePermissions,
} from "@/hooks/services/workspace/use-shared-with-user";
import type { ListPermissionsResult } from "@/lib/services/workspace/shared";
import { useAuth } from "@/contexts/auth-context";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { WorkspaceDataTable } from "./workspace-data-table";
import { InfoPanel } from "@/components/containers/InfoPanel";
import { WorkspaceActionBar } from "./workspace-action-bar";
import { isFolderType } from "./workspace-item-icon";
import { PanelRightOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WorkspaceBrowserItem,
  WorkspaceBrowserSort,
} from "@/types/workspace-browser";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type WorkspaceViewMode = "home" | "shared";

interface WorkspaceBrowserProps {
  /** "home" = current user's home; "shared" = shared-with-me / shared folder view */
  mode: WorkspaceViewMode;
  /** Username from URL segment (e.g. workspace/chrescobar/home) */
  username: string;
  path: string;
  /** Optional initial data for shared mode (SSR/prefetch) */
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

export function WorkspaceBrowser({
  mode,
  username,
  path,
  initialSharedItems,
  initialPathItems,
  initialPermissions,
}: WorkspaceBrowserProps) {
  const router = useRouter();
  const { user } = useAuth();
  const currentUser = user?.username ?? "";
  const fullWorkspaceUsername =
    (user?.realm ? `${user.username}@${user.realm}` : null) ?? user?.username ?? "";
  const myWorkspaceRoot = fullWorkspaceUsername || currentUser;

  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAuthChecked(true), 800);
    return () => clearTimeout(t);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<WorkspaceBrowserItem | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [panelWidth, setPanelWidth] = useState(320);

  const MIN_PANEL_WIDTH = 280;
  const MAX_PANEL_WIDTH = 600;

  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;

    function onMove(moveEvent: MouseEvent) {
      const delta = startX - moveEvent.clientX;
      const next = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startW + delta));
      setPanelWidth(next);
    }
    function onUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  const [sort, setSort] = useState<WorkspaceBrowserSort>({
    field: "name",
    direction: "asc",
  });

  const isHome = mode === "home";
  const isAtSharedRoot = !isHome && (!path || path === "");
  const fullPath = path ? `/${path}` : "";

  const homeQuery = useWorkspaceBrowser({
    username: currentUser,
    path,
    enabled: isHome && !!currentUser,
  });

  const sharedQuery = useSharedWithUser({
    username: currentUser,
    enabled: !isHome && isAtSharedRoot && !!currentUser,
    initialData: !isHome && isAtSharedRoot ? initialSharedItems : undefined,
  });

  const userWorkspacesQuery = useUserWorkspaces({
    username: currentUser,
    enabled: !isHome && isAtSharedRoot && !!currentUser,
  });

  const pathQuery = useWorkspaceListByPath({
    fullPath,
    enabled: !isHome && !isAtSharedRoot && !!fullPath,
    initialData: !isHome && !isAtSharedRoot ? initialPathItems : undefined,
  });

  useWorkspaceGet({
    objectPaths: !isHome && !isAtSharedRoot && fullPath ? [fullPath] : [],
    enabled: !isHome && !isAtSharedRoot && !!fullPath,
  });

  const rootItems = useMemo(() => {
    if (isHome || !isAtSharedRoot) return [];
    const shared = sharedQuery.data ?? [];
    const userData = userWorkspacesQuery.data ?? [];
    const byPath = new Map<string, WorkspaceBrowserItem>();
    for (const item of [...userData, ...shared]) {
      if (!byPath.has(item.path)) byPath.set(item.path, item);
    }
    return Array.from(byPath.values());
  }, [isHome, isAtSharedRoot, sharedQuery.data, userWorkspacesQuery.data]);

  const items = isHome
    ? (homeQuery.data ?? [])
    : isAtSharedRoot
      ? rootItems
      : pathQuery.data ?? [];
  const itemPaths = useMemo(() => items.map((i) => i.path), [items]);
  const permissionsQuery = useWorkspacePermissions({
    paths: itemPaths,
    enabled: !isHome && itemPaths.length > 0,
    initialData: !isHome ? initialPermissions : undefined,
  });

  const memberCountByPath = useMemo(() => {
    if (isHome) return undefined;
    const perms = permissionsQuery.data;
    if (!perms) return undefined;
    const out: Record<string, number> = {};
    for (const pathEntry of itemPaths) {
      const list = perms[pathEntry];
      out[pathEntry] = Array.isArray(list) ? list.length : 0;
    }
    return out;
  }, [isHome, permissionsQuery.data, itemPaths]);

  const isLoading = isHome
    ? homeQuery.isLoading
    : isAtSharedRoot
      ? sharedQuery.isLoading || userWorkspacesQuery.isLoading
      : pathQuery.isLoading;
  const error = isHome
    ? homeQuery.error
    : isAtSharedRoot
      ? sharedQuery.error ?? userWorkspacesQuery.error
      : pathQuery.error;
  const refetch = isHome
    ? homeQuery.refetch
    : isAtSharedRoot
      ? () => {
          void sharedQuery.refetch();
          void userWorkspacesQuery.refetch();
        }
      : pathQuery.refetch;
  const isFetching = isHome
    ? homeQuery.isFetching
    : isAtSharedRoot
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

  const isUrlCurrentUser =
    username === currentUser ||
    username === fullWorkspaceUsername ||
    username === myWorkspaceRoot ||
    (currentUser && username.startsWith(`${currentUser}@`));
  useEffect(() => {
    if (isHome || !isAtSharedRoot || !myWorkspaceRoot || isUrlCurrentUser) return;
    router.replace(`/workspace/${encodeWorkspaceSegment(myWorkspaceRoot)}`);
  }, [isHome, isAtSharedRoot, myWorkspaceRoot, isUrlCurrentUser, username, router]);

  function handleItemDoubleClick(item: WorkspaceBrowserItem) {
    if (!isFolderType(item.type)) return;
    if (isHome) {
      const segments = path
        ? path.split("/").map(sanitizePathSegment).filter(Boolean)
        : [];
      segments.push(sanitizePathSegment(item.name));
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      const homeBase = `/workspace/${encodeWorkspaceSegment(username)}/home`;
      router.push(`${homeBase}/${encoded}`);
    } else {
      const segments = item.path
        .replace(/^\//, "")
        .split("/")
        .map(sanitizePathSegment)
        .filter(Boolean);
      const encoded = segments.map(encodeWorkspaceSegment).join("/");
      router.push(`/workspace/${encoded}`);
    }
    setSelectedItem(null);
  }

  function handleSelectItem(item: WorkspaceBrowserItem) {
    setSelectedItem(item);
    setPanelExpanded(true);
  }

  if (!currentUser) {
    if (mode === "shared" && !authChecked) {
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

  const errorMessage =
    mode === "home"
      ? "Failed to load workspace contents"
      : "Failed to load shared folders";

  return (
    <div className="flex min-h-0 w-full flex-1 gap-0 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 space-y-4 p-4 ">
          <WorkspaceBreadcrumbs
            path={path}
            username={username}
            itemCount={items.length}
            viewMode={
              isHome ? "home" : isAtSharedRoot ? "root" : "shared"
            }
            currentUsername={currentUser}
            workspaceRootUsername={isHome ? undefined : myWorkspaceRoot}
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
                {errorMessage}: {error.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <WorkspaceDataTable
            items={processedItems}
            isLoading={isLoading}
            path={path}
            sort={sort}
            onSortChange={setSort}
            showViewSharedRow={
              isHome &&
              (!path || path === "" || path === "/" || !path.trim())
            }
            viewMode={isHome ? "home" : "shared"}
            username={username}
            sharedRootUsername={isHome ? undefined : myWorkspaceRoot}
            memberCountByPath={memberCountByPath}
            selectedPath={selectedItem?.path ?? null}
            onSelect={handleSelectItem}
            onItemDoubleClick={handleItemDoubleClick}
          />
        </div>
      </div>

      {selectedItem && (
        <aside className="flex h-full min-h-0 shrink-0 border-l bg-muted/30 rounded-tl-lg rounded-bl-lg">
          <div className="flex h-full flex-col w-[80px] shrink-0 border-r border-border/50 bg-muted/50 py-2 rounded-l-lg">
            {!panelExpanded && (
              <Button
                variant="ghost"
                size="sm"
                className="mx-0.5 mb-1 justify-start gap-1 font-normal"
                onClick={() => setPanelExpanded(true)}
                title="Show details"
              >
                <PanelRightOpen className="h-4 w-4 shrink-0" />
                Show
              </Button>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
              <WorkspaceActionBar
                selection={[selectedItem]}
                onAction={() => {}}
              />
            </div>
            {/* <Button
              variant="ghost"
              size="sm"
              className="mx-0.5 mt-1 shrink-0 justify-start gap-1 font-normal text-muted-foreground"
              onClick={() => setSelectedItem(null)}
              title="Close"
            >
              <X className="h-4 w-4 shrink-0" />
              Close
            </Button> */}
          </div>
          {panelExpanded && (
            <>
              <div
                role="separator"
                aria-label="Resize panel"
                className="w-1 shrink-0 cursor-col-resize touch-none border-l border-border/50 bg-border/30 hover:bg-primary/20 active:bg-primary/30 transition-colors"
                onMouseDown={handlePanelResizeStart}
              />
              <div
                className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden"
                style={{ width: panelWidth, minWidth: MIN_PANEL_WIDTH }}
              >
                <InfoPanel
                  variant="workspace"
                  workspaceItem={selectedItem}
                  onClose={() => setPanelExpanded(false)}
                />
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
