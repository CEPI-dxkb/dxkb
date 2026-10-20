"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { workspaceNavItems } from "@/components/navbars/navbar-links";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { useRecentWorkspaceFolders } from "@/hooks/use-recent-workspace-folders";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { getWorkspaceFolderDisplayName } from "@/lib/recent-workspace-folders";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { buildFolderHref, resolveWorkspaceHref } from "./workspace-nav-utils";

interface WorkspaceDropdownContentProps {
  isAuthenticated: boolean;
  wsUsername: string;
}

export function WorkspaceDropdownContent({
  isAuthenticated,
  wsUsername,
}: WorkspaceDropdownContentProps) {
  const favorites = useQuery({
    queryKey: workspaceQueryKeys.favorites(wsUsername),
    queryFn: () => loadFavorites(wsUsername),
    enabled: isAuthenticated && !!wsUsername,
    staleTime: 2 * 60 * 1000,
  });
  const favoritePaths = favorites.data ?? [];
  // A Retry keeps the failure up ("Retrying…") instead of going back to the
  // skeletons until it answers.
  const favoritesRetry = useRetryKeepingError(favorites, wsUsername);

  const recentFolders = useRecentWorkspaceFolders(
    isAuthenticated ? wsUsername : undefined,
  );

  const { workspaces, data } = workspaceNavItems;

  return (
    <div className="p-2 lg:w-125">
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
      {isAuthenticated &&
        (favoritePaths.length > 0 ||
          recentFolders.length > 0 ||
          favorites.isLoading ||
          favoritesRetry.error != null) && (
          <div className="mt-1 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {/* Favorite Folders */}
              <div>
                <SectionHeader>
                  Favorite Folders{" "}
                  <Star className="size-4 text-highlight" fill="currentColor" />
                </SectionHeader>
                {favoritesRetry.error ? (
                  <Alert variant="destructive" size="sm">
                    <AlertDescription>
                      <p>
                        Couldn&apos;t load favorites:{" "}
                        {formatUserFacingErrorMessage(
                          favoritesRetry.error,
                          "the workspace service did not answer.",
                        )}
                      </p>
                      <QueryRetryButton
                        retrying={favoritesRetry.retrying}
                        onRetry={favoritesRetry.retry}
                      />
                    </AlertDescription>
                  </Alert>
                ) : favorites.isLoading ? (
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
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    No favorites yet
                  </p>
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
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    No recent folders
                  </p>
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
    <h4 className="my-0.5 flex items-center gap-1 rounded-md bg-primary p-2 text-sm font-bold text-white">
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
          className="my-0.5 block truncate p-2 font-medium hover:bg-secondary/20"
        />
      }
    >
      {title}
    </NavigationMenuLink>
  );
}
