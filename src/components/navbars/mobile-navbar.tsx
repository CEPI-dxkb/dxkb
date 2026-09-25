"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { NavbarThemeSwitcher } from "@/components/navbars/theme-switcher-navbar";
import { Command as CommandIcon, Menu, Search, ChevronUp } from "lucide-react";

import { workspaceUsername } from "@/lib/services/workspace/path-utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SearchBar } from "@/components/search/search-bar";
import { openCommandPalette } from "@/components/search/command-palette-events";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useAuth } from "@/lib/auth/provider";
import Logo from "@/components/ui/logo";
import { UserAvatarDropdown } from "@/components/navbars/user-avatar-dropdown";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import { getRecentFolders } from "@/lib/recent-workspace-folders";
import { SuBanner } from "@/components/auth/su-banner";
import { JobStatusPill } from "@/components/jobs/job-status-pill";
import { MobileSheetNavigation } from "@/components/navbars/mobile-sheet-navigation";

const useMobileNavbar = () => {
  const { isAuthenticated, user } = useAuth();
  const wsUsername = workspaceUsername(user);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 63.999rem)");
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  const { data: favoritePaths = [] } = useQuery({
    queryKey: workspaceQueryKeys.favorites(wsUsername),
    queryFn: () => loadFavorites(wsUsername),
    enabled: isAuthenticated && !!wsUsername,
    staleTime: 2 * 60 * 1000,
  });

  const recentFolders = isAuthenticated ? getRecentFolders(wsUsername) : [];

  return (
    <header className="flex flex-col bg-primary lg:hidden">
      <div className="flex items-center justify-between p-4 text-primary-foreground">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger
              render={(triggerProps) => (
                <Button
                  variant="ghost"
                  aria-label="Open navigation menu"
                  className="group hover:bg-white/15"
                  {...triggerProps}
                >
                  <Menu
                    aria-hidden="true"
                    className="scale-125 text-primary-foreground transition-transform duration-300 group-hover:scale-150"
                    data-icon="inline-start"
                  />
                </Button>
              )}
            />

            <SheetContent
              side="left"
              className="w-[85vw] max-w-md overflow-y-auto p-0"
            >
              <SheetTitle className="sr-only">
                Mobile Navigation Menu
              </SheetTitle>

              <MobileSheetNavigation
                favoritePaths={favoritePaths}
                isAuthenticated={isAuthenticated}
                recentFolders={recentFolders}
                wsUsername={wsUsername}
              />
            </SheetContent>
          </Sheet>

          <Link id="dxkb-logo-mobile" href="/">
            <Logo
              variant="logo-icon"
              width={474}
              height={527}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <span className="mt-0 self-start text-2xs font-semibold text-white/90 italic">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            onClick={openCommandPalette}
            aria-label="Open command palette"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <CommandIcon size={18} />
          </Button>
          {!isHome && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
              }}
              aria-label={isSearchOpen ? "Close search" : "Open search"}
            >
              {isSearchOpen ? <ChevronUp size={18} /> : <Search size={18} />}
            </Button>
          )}

          <NavbarThemeSwitcher />

          {!isAuthenticated && (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "text-primary-foreground hover:bg-white/15",
                })}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "border-primary-foreground text-foreground hover:bg-primary-foreground hover:text-primary",
                })}
              >
                Sign Up
              </Link>
            </>
          )}

          {isAuthenticated && (
            <>
              {isMobileViewport && <JobStatusPill />}
              <UserAvatarDropdown />
            </>
          )}
        </div>
      </div>

      {!isHome && (
        <div
          className={`grid transition-[grid-template-rows] duration-150 ease-in-out ${
            isSearchOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
          inert={!isSearchOpen ? true : undefined}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-4">
              <SearchBar />
            </div>
          </div>
        </div>
      )}
      <SuBanner />
    </header>
  );
};

const MobileNavbar = () => useMobileNavbar();

export default MobileNavbar;
