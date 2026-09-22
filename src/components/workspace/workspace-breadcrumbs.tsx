"use client";

import Link from "next/link";
import { ChevronRight, Globe, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildWorkspaceBreadcrumbs,
  type WorkspaceBreadcrumbViewMode,
} from "@/lib/services/workspace/path-utils";

interface WorkspaceBreadcrumbsProps {
  path: string;
  username: string;
  itemCount?: number;
  viewMode?: WorkspaceBreadcrumbViewMode;
  /** When provided, segments matching this user are shown without @bvbrc / @patricbrc.org */
  currentUsername?: string;
  /** When viewMode is "shared", first breadcrumb links here (current user's workspace root) */
  workspaceRootUsername?: string;
}

export function WorkspaceBreadcrumbs({
  path,
  username,
  itemCount,
  viewMode = "home",
  currentUsername,
  workspaceRootUsername,
}: WorkspaceBreadcrumbsProps) {
  const breadcrumbs = buildWorkspaceBreadcrumbs({
    mode: viewMode,
    path,
    username,
    currentUsername,
    workspaceRootUsername,
  });

  return (
    <nav
      aria-label="Workspace path"
      className="flex flex-wrap items-center gap-1 text-sm"
    >
      {breadcrumbs.map((breadcrumb, index) => {
        const content = (
          <>
            {breadcrumb.icon === "home" && <Home className="size-3.5" />}
            {breadcrumb.icon === "public" && <Globe className="size-3.5" />}
            <span>{breadcrumb.label}</span>
          </>
        );

        return (
          <span
            key={breadcrumb.href ?? `current-${breadcrumb.label}`}
            className="flex items-center gap-1"
          >
            {index > 0 && (
              <ChevronRight className="text-muted-foreground size-3.5" />
            )}
            {breadcrumb.href ? (
              <Link
                href={breadcrumb.href}
                className={cn(
                  "hover:text-foreground flex items-center gap-1 font-medium transition-colors",
                  breadcrumb.muted
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {content}
              </Link>
            ) : (
              <span className="text-foreground flex items-center gap-1 font-medium">
                {content}
              </span>
            )}
          </span>
        );
      })}
      {itemCount !== undefined && (
        <span className="text-muted-foreground ml-2 text-xs">
          ({itemCount} {itemCount === 1 ? "item" : "items"})
        </span>
      )}
    </nav>
  );
}
