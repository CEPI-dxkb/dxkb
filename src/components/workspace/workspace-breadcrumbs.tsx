"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Globe, Home } from "lucide-react";
import { buildEncodedSegmentPath, cn, encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";

export type BreadcrumbsViewMode = "home" | "shared" | "root" | "public";

interface WorkspaceBreadcrumbsProps {
  path: string;
  username: string;
  itemCount?: number;
  viewMode?: BreadcrumbsViewMode;
  /** When provided, segments matching this user are shown without @bvbrc / @patricbrc.org */
  currentUsername?: string;
  /** When viewMode is "shared", first breadcrumb links here (current user's workspace root) */
  workspaceRootUsername?: string;
}

function formatSegmentLabel(
  segment: string,
  currentUsername?: string,
): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  const safe = sanitizePathSegment(decoded);
  if (!currentUsername) return safe;
  if (safe === currentUsername) return safe;
  if (safe.startsWith(`${currentUsername}@`)) return currentUsername;
  return safe;
}

export function WorkspaceBreadcrumbs({
  path,
  username,
  itemCount,
  viewMode = "home",
  currentUsername,
  workspaceRootUsername,
}: WorkspaceBreadcrumbsProps) {
  const segments = useMemo(
    () => path.split("/").map((s) => sanitizePathSegment(s)).filter(Boolean),
    [path],
  );

  const safeUsername = sanitizePathSegment(username);
  const encodedUser = encodeWorkspaceSegment(safeUsername);
  const usernameRootHref = username ? `/workspace/${encodedUser}` : "/workspace";
  const homeBase = username ? `/workspace/${encodedUser}/home` : "/workspace/home";
  const _baseHref = viewMode === "shared" ? usernameRootHref : homeBase;
  const segmentHrefPrefix =
    viewMode === "shared" ? `${usernameRootHref}/` : `${homeBase}/`;

  if (viewMode === "root") {
    return (
      <nav aria-label="Workspace path" className="flex flex-wrap items-center gap-1 text-sm">
        <Link
          href={usernameRootHref}
          className="text-foreground font-medium transition-colors hover:text-foreground"
        >
          {formatSegmentLabel(safeUsername, currentUsername)}
        </Link>
        {itemCount !== undefined && (
          <span className="text-muted-foreground ml-2 text-xs">
            ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
        )}
      </nav>
    );
  }

  if (viewMode === "public") {
    return (
      <nav aria-label="Workspace path" className="flex flex-wrap items-center gap-1 text-sm">
        {segments.length === 0 ? (
          <span className="text-foreground flex items-center gap-1 font-medium">
            <Globe className="h-3.5 w-3.5" />
            <span>Public Workspaces</span>
          </span>
        ) : (
          <Link
            href="/workspace/public"
            className="text-muted-foreground flex items-center gap-1 font-medium transition-colors hover:text-foreground"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Public Workspaces</span>
          </Link>
        )}
        {segments.map((segment, index) => {
          const segmentPath = buildEncodedSegmentPath(segments.slice(0, index + 1));
          const href = `/workspace/public/${segmentPath}`;
          const isLast = index === segments.length - 1;

          return (
            <span key={href} className="flex items-center gap-1">
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
              {isLast ? (
                <span className="text-foreground font-medium">
                  {formatSegmentLabel(segment, currentUsername)}
                </span>
              ) : (
                <Link
                  href={href}
                  className="text-muted-foreground font-medium transition-colors hover:text-foreground"
                >
                  {formatSegmentLabel(segment, currentUsername)}
                </Link>
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

  if (viewMode === "shared") {
    return (
      <nav aria-label="Workspace path" className="flex flex-wrap items-center gap-1 text-sm">
        {segments.map((segment, index) => {
          const segmentPath = buildEncodedSegmentPath(segments.slice(0, index + 1));
          const myRoot = workspaceRootUsername || currentUsername;
          const href =
            index === 0 && myRoot
              ? `/workspace/${encodeWorkspaceSegment(myRoot)}`
              : `/workspace/${segmentPath}`;
          const isLast = index === segments.length - 1;

          return (
            <span key={href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
              )}
              {isLast ? (
                <span className="text-foreground font-medium">
                  {formatSegmentLabel(segment, currentUsername)}
                </span>
              ) : (
                <Link
                  href={href}
                  className="text-muted-foreground font-medium transition-colors hover:text-foreground"
                >
                  {formatSegmentLabel(segment, currentUsername)}
                </Link>
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

  return (
    <nav aria-label="Workspace path" className="flex flex-wrap items-center gap-1 text-sm">
      <Link
        href={usernameRootHref}
        className={cn(
          "flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          segments.length === 0 ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Home className="h-3.5 w-3.5" />
        <span>{formatSegmentLabel(safeUsername, currentUsername)}</span>
      </Link>

      <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />

      {segments.length === 0 ? (
        <span className="text-foreground font-medium">home</span>
      ) : (
        <Link
          href={homeBase}
          className="text-muted-foreground font-medium transition-colors hover:text-foreground"
        >
          home
        </Link>
      )}

      {segments.map((segment, index) => {
        const segmentPath = segments
          .slice(0, index + 1)
          .map(encodeWorkspaceSegment)
          .join("/");
        const href = segmentHrefPrefix + segmentPath;
        const isLast = index === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
            {isLast ? (
              <span className="text-foreground font-medium">
                {formatSegmentLabel(segment, currentUsername)}
              </span>
            ) : (
              <Link
                href={href}
                className="text-muted-foreground font-medium transition-colors hover:text-foreground"
              >
                {formatSegmentLabel(segment, currentUsername)}
              </Link>
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
