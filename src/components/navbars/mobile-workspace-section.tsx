import Link from "next/link";
import { Star } from "lucide-react";

import { MobileDecoratedSubSection } from "@/components/navbars/mobile-decorated-subsection";
import { MobileNavLink } from "@/components/navbars/mobile-nav-link";
import { MobileSubSectionLabel } from "@/components/navbars/mobile-subsection-label";
import { workspaceNavItems } from "@/components/navbars/navbar-links";
import {
  buildFolderHref,
  resolveWorkspaceHref,
} from "@/components/navbars/workspace-nav-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import {
  getWorkspaceFolderDisplayName,
  type RecentFolder,
} from "@/lib/recent-workspace-folders";
import { formatUserFacingErrorMessage } from "@/lib/utils";

interface MobileWorkspaceSectionProps {
  favoritePaths: string[];
  /** Why the favorites failed to load; shown instead of hiding the section. */
  favoritesError?: unknown;
  /** The favorites' Retry is in flight; its button reads "Retrying…". */
  favoritesRetrying?: boolean;
  onRetryFavorites?: () => void;
  isAuthenticated: boolean;
  recentFolders: RecentFolder[];
  wsUsername: string;
}

export function MobileWorkspaceSection({
  favoritePaths,
  favoritesError,
  favoritesRetrying = false,
  onRetryFavorites,
  isAuthenticated,
  recentFolders,
  wsUsername,
}: MobileWorkspaceSectionProps) {
  return (
    <div className="flex flex-col gap-1.5 px-5 pt-2 pb-3">
      <MobileDecoratedSubSection alwaysShow>
        <MobileSubSectionLabel>
          {workspaceNavItems.workspaces.title}
        </MobileSubSectionLabel>
        {workspaceNavItems.workspaces.items.map((item) => (
          <MobileNavLink
            key={item.title}
            href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
          >
            {item.title}
          </MobileNavLink>
        ))}
      </MobileDecoratedSubSection>

      <MobileDecoratedSubSection alwaysShow>
        <MobileSubSectionLabel>
          {workspaceNavItems.data.title}
        </MobileSubSectionLabel>
        {workspaceNavItems.data.items.map((item) => (
          <MobileNavLink
            key={item.title}
            href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
          >
            {item.title}
          </MobileNavLink>
        ))}
      </MobileDecoratedSubSection>

      {isAuthenticated && (favoritePaths.length > 0 || favoritesError != null) && (
        <MobileDecoratedSubSection
          alwaysShow
          dotColor="bg-highlight/50"
          lineColor="bg-highlight/25"
          curveColor="border-highlight/25"
        >
          <MobileSubSectionLabel>
            Favorites <Star className="size-3 fill-highlight text-highlight" />
          </MobileSubSectionLabel>
          {favoritesError ? (
            <Alert variant="destructive" size="sm">
              <AlertDescription>
                <p>
                  Couldn&apos;t load favorites:{" "}
                  {formatUserFacingErrorMessage(
                    favoritesError,
                    "the workspace service did not answer.",
                  )}
                </p>
                {onRetryFavorites && (
                  <QueryRetryButton
                    retrying={favoritesRetrying}
                    onRetry={onRetryFavorites}
                  />
                )}
              </AlertDescription>
            </Alert>
          ) : (
            favoritePaths.map((path) => (
              <MobileNavLink key={path} href={buildFolderHref(path)}>
                {getWorkspaceFolderDisplayName(path)}
              </MobileNavLink>
            ))
          )}
        </MobileDecoratedSubSection>
      )}

      {isAuthenticated && recentFolders.length > 0 && (
        <MobileDecoratedSubSection alwaysShow>
          <MobileSubSectionLabel>Recently Visited</MobileSubSectionLabel>
          {recentFolders.map((folder) => (
            <MobileNavLink
              key={folder.path}
              href={buildFolderHref(folder.path)}
            >
              {getWorkspaceFolderDisplayName(folder.path)}
            </MobileNavLink>
          ))}
        </MobileDecoratedSubSection>
      )}

      {!isAuthenticated && (
        <div className="mt-4 rounded-xl border border-secondary/20 bg-linear-to-br from-secondary/5 to-accent/5 p-4">
          <p className="mb-3 text-sm font-medium text-foreground/80">
            Sign in to access your full workspace.
          </p>
          <Link
            href="/sign-in?redirect=/workspace"
            className={buttonVariants({
              variant: "cta",
              size: "sm",
              className: "w-fit",
            })}
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
