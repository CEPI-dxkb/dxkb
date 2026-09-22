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
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getWorkspaceFolderDisplayName,
  type RecentFolder,
} from "@/lib/recent-workspace-folders";

interface MobileWorkspaceSectionProps {
  favoritePaths: string[];
  isAuthenticated: boolean;
  recentFolders: RecentFolder[];
  wsUsername: string;
}

export function MobileWorkspaceSection({
  favoritePaths,
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

      {isAuthenticated && favoritePaths.length > 0 && (
        <MobileDecoratedSubSection
          alwaysShow
          dotColor="bg-amber-400/50"
          lineColor="bg-amber-400/25"
          curveColor="border-amber-400/25"
        >
          <MobileSubSectionLabel>
            Favorites <Star className="size-3 fill-amber-400 text-amber-400" />
          </MobileSubSectionLabel>
          {favoritePaths.map((path) => (
            <MobileNavLink key={path} href={buildFolderHref(path)}>
              {getWorkspaceFolderDisplayName(path)}
            </MobileNavLink>
          ))}
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
        <div className="border-secondary/20 from-secondary/5 to-accent/5 mt-4 rounded-xl border bg-linear-to-br p-4">
          <p className="text-foreground/80 mb-3 text-sm font-medium">
            Sign in to access your full workspace.
          </p>
          <Link
            href="/sign-in?redirect=/workspace"
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "bg-secondary hover:bg-secondary/90 w-fit",
            })}
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
