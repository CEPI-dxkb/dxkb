"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { workspaceNavItems, type WorkspaceNavItem } from "@/components/navbars/navbar-links";
import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { getRecentFolders, getWorkspaceFolderDisplayName } from "@/lib/recent-workspace-folders";
import { buildEncodedSegmentPath, encodeWorkspaceSegment, parsePathSegments, workspaceUsername } from "@/lib/utils";

export { workspaceUsername };

/** Resolve a nav item's href for the current user state. */
export function resolveWorkspaceHref(
  item: WorkspaceNavItem,
  wsUsername: string,
  isAuthenticated: boolean,
): string {
  if (item.requiresAuth && !isAuthenticated) {
    return item.signInRedirect ?? "/sign-in?redirect=/workspace";
  }
  return typeof item.href === "function"
    ? item.href(encodeWorkspaceSegment(wsUsername))
    : item.href;
}

/** Convert a full workspace path (e.g. /user@bvbrc/home/folder) to a browser URL. */
export function buildFolderHref(folderPath: string): string {
  return `/workspace/${buildEncodedSegmentPath(parsePathSegments(folderPath))}`;
}

interface WorkspaceDropdownContentProps {
  isAuthenticated: boolean;
  wsUsername: string;
}

export function WorkspaceDropdownContent({
  isAuthenticated,
  wsUsername,
}: WorkspaceDropdownContentProps) {
  const { data: favoritePaths = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ["workspace-favorites", wsUsername],
    queryFn: () => loadFavorites(wsUsername),
    enabled: isAuthenticated && !!wsUsername,
    staleTime: 2 * 60 * 1000,
  });

  const recentFolders = isAuthenticated ? getRecentFolders(wsUsername) : [];

  const { workspaces, data } = workspaceNavItems;

  return (
    <div className="p-2 lg:w-[500px]">
      {/* Top: static sections in 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left column: Workspaces */}
        <div>
          <SectionHeader>{workspaces.title}</SectionHeader>
          {workspaces.items.map((item) => (
            <NavItem
              key={item.title}
              href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
              title={item.title}
            />
          ))}
        </div>

        {/* Right column: Data */}
        <div>
          <SectionHeader>{data.title}</SectionHeader>
          {data.items.map((item) => (
            <NavItem
              key={item.title}
              href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
              title={item.title}
            />
          ))}
        </div>
      </div>

      {/* Bottom: dynamic sections (authenticated only) */}
      {isAuthenticated && (favoritePaths.length > 0 || recentFolders.length > 0 || favoritesLoading) && (
        <div className="mt-1 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {/* Favorite Folders */}
            <div>
              <SectionHeader>
                Favorite Folders <Star className="h-4 w-4 text-amber-400" fill="currentColor" />
              </SectionHeader>
              {favoritesLoading ? (
                <div className="space-y-1 p-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ) : favoritePaths.length > 0 ? (
                favoritePaths.map((path) => (
                  <NavItem
                    key={path}
                    href={buildFolderHref(path)}
                    title={getWorkspaceFolderDisplayName(path)}
                  />
                ))
              ) : (
                <p className="px-2 py-1 text-sm text-muted-foreground">No favorites yet</p>
              )}
            </div>

            {/* Recently Visited Folders */}
            <div>
              <SectionHeader>Recently Visited Folders</SectionHeader>
              {recentFolders.length > 0 ? (
                recentFolders.map((folder) => (
                  <NavItem
                    key={folder.path}
                    href={buildFolderHref(folder.path)}
                    title={getWorkspaceFolderDisplayName(folder.path)}
                  />
                ))
              ) : (
                <p className="px-2 py-1 text-sm text-muted-foreground">No recent folders</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="bg-primary my-0.5 flex items-center gap-1 rounded-md p-2 text-sm font-bold text-white">
      {children}
    </h4>
  );
}

function NavItem({ href, title }: { href: string; title: string }) {
  return (
    <NavigationMenuLink
      render={
        <Link
          href={href}
          className="hover:bg-secondary/20 my-0.5 block truncate p-2 font-medium"
        />
      }
    >
      {title}
    </NavigationMenuLink>
  );
}
