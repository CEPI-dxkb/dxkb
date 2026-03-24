"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { gettingStartedItems, organismItems, serviceItems, workspaceNavItems } from "@/components/navbars/navbar-links";
import { workspaceUsername, resolveWorkspaceHref, buildFolderHref } from "@/components/navbars/workspace-dropdown-content";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MobileSearchBar } from "@/components/search/mobile-search-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import Logo from "@/components/ui/logo";
import { UserAvatarDropdown } from "@/components/navbars/user-avatar-dropdown";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { getRecentFolders, getWorkspaceFolderDisplayName } from "@/lib/recent-workspace-folders";

import { Menu, Search, ChevronUp } from "lucide-react";

const MobileNavbar = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const wsUsername = workspaceUsername(user);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { data: favoritePaths = [] } = useQuery({
    queryKey: ["workspace-favorites", wsUsername],
    queryFn: () => loadFavorites(wsUsername),
    enabled: isAuthenticated && !!wsUsername,
    staleTime: 2 * 60 * 1000,
  });

  const recentFolders = isAuthenticated ? getRecentFolders(wsUsername) : [];

  return (
    <header className="bg-primary flex flex-col lg:hidden">
      <div className="flex items-center justify-between px-4 py-4 text-foreground">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger
            render={(triggerProps) => (
              <Button variant="ghost" className="group hover:bg-gray-300/50" {...triggerProps}>
                <Menu className="scale-125 text-foreground transition-all duration-300 group-hover:scale-150 group-hover:text-white" data-icon="inline-start" />
              </Button>
            )}
          />
          <SheetContent
            side="left"
            className="w-[85vw] max-w-md overflow-y-auto p-0"
          >
            <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>
            <div id="sheet-logo" className="bg-primary flex w-full p-4">
              <Logo
                variant="logo-white"
                width={100}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </div>

            <div className="flex flex-col divide-y divide-muted-foreground">
              {/* Getting Started Section */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Getting Started</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {gettingStartedItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="mobile-nav-link"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Organisms Section */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Organisms</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {organismItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="mobile-nav-link"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Services Sections */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Services</h2>
                <div className="grid grid-cols-1 gap-y-4">
                  {Object.entries(serviceItems).map(([key, section]) => (
                    <div key={key}>
                      <h3 className="mobile-nav-divider-title">
                        {section.title}
                      </h3>
                      <div className="grid grid-cols-2">
                        {section.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="mobile-nav-link"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workspace Section */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Workspace</h2>
                {isLoading ? (
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-24 bg-muted" />
                    <Skeleton className="h-5 w-32 bg-muted" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-y-4">
                    {/* Workspaces subsection */}
                    <div>
                      <h3 className="mobile-nav-divider-title">
                        {workspaceNavItems.workspaces.title}
                      </h3>
                      <div className="grid grid-cols-2">
                        {workspaceNavItems.workspaces.items.map((item) => (
                          <Link
                            key={item.title}
                            href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
                            className="mobile-nav-link"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Data subsection */}
                    <div>
                      <h3 className="mobile-nav-divider-title">
                        {workspaceNavItems.data.title}
                      </h3>
                      <div className="grid grid-cols-2">
                        {workspaceNavItems.data.items.map((item) => (
                          <Link
                            key={item.title}
                            href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
                            className="mobile-nav-link"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Favorites (authenticated only) */}
                    {isAuthenticated && favoritePaths.length > 0 && (
                      <div>
                        <h3 className="mobile-nav-divider-title">
                          Favorite Folders <Star className="h-3.5 w-3.5 text-amber-400" />
                        </h3>
                        <div className="grid grid-cols-2">
                          {favoritePaths.map((path) => (
                            <Link
                              key={path}
                              href={buildFolderHref(path)}
                              className="mobile-nav-link"
                            >
                              {getWorkspaceFolderDisplayName(path)}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recently Visited (authenticated only) */}
                    {isAuthenticated && recentFolders.length > 0 && (
                      <div>
                        <h3 className="mobile-nav-divider-title">
                          Recently Visited Folders
                        </h3>
                        <div className="grid grid-cols-2">
                          {recentFolders.map((folder) => (
                            <Link
                              key={folder.path}
                              href={buildFolderHref(folder.path)}
                              className="mobile-nav-link"
                            >
                              {getWorkspaceFolderDisplayName(folder.path)}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sign-in prompt for unauthenticated users */}
                    {!isAuthenticated && (
                      <div>
                        <Link
                          href="/sign-in?redirect=/workspace"
                          className="text-sm text-muted-foreground mb-2 block hover:text-foreground hover:underline focus:outline-none focus:underline"
                        >
                          Sign in to view your full workspace.
                        </Link>
                        <Link
                          href="/sign-in?redirect=/workspace"
                          className={buttonVariants({
                            variant: "default",
                            size: "sm",
                            className: "w-fit",
                          })}
                        >
                          Sign In
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Link id="dxkb-logo" href="/">
          <Logo
            variant="logo-icon"
            width={100}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        {/* Search/Chevron Icon Button - only show when not on home */}
        {!isHome && (
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground hover:bg-gray-300/50"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label={isSearchOpen ? "Close search" : "Open search"}
          >
            {isSearchOpen ? (
              <ChevronUp size={18} />
            ) : (
              <Search size={18} />
            )}
          </Button>
        )}

        {/* Show skeleton while loading */}
        {isLoading && (
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-16 bg-white/20" />
            <Skeleton className="h-8 w-20 bg-white/20" />
          </div>
        )}

        {/* Show sign in/sign up when NOT authenticated and not loading */}
        {!isLoading && !isAuthenticated && (
          <>
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "text-foreground hover:bg-gray-300/50",
              })}
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "border-foreground text-foreground hover:bg-foreground hover:text-background",
              })}
            >
              Sign Up
            </Link>
          </>
        )}

        {/* Avatar dropdown when authenticated */}
        {!isLoading && isAuthenticated && <UserAvatarDropdown />}
      </div>
    </div>

      {!isHome && isSearchOpen && (
        <div className="px-4 pb-4">
          <MobileSearchBar
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
          />
        </div>
      )}
    </header>
  );
};

export default MobileNavbar;
