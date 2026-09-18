"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { NavbarThemeSwitcher } from "@/components/navbars/theme-switcher-navbar";
import {
  Star,
  ChevronDown,
  Command as CommandIcon,
  Menu,
  Search,
  ChevronUp,
  BookOpen,
  Bug,
  FlaskConical,
  FolderOpen,
} from "lucide-react";

import {
  resourcesItems,
  organismItems,
  serviceItems,
  workspaceNavItems,
  type NavSection,
} from "@/components/navbars/navbar-links";
import { workspaceUsername } from "@/lib/services/workspace/path-utils";
import {
  resolveWorkspaceHref,
  buildFolderHref,
} from "@/components/navbars/workspace-nav-utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { SearchBar } from "@/components/search/search-bar";
import { openCommandPalette } from "@/components/search/command-palette-events";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useAuth } from "@/lib/auth/provider";
import Logo from "@/components/ui/logo";
import { UserAvatarDropdown } from "@/components/navbars/user-avatar-dropdown";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import {
  getRecentFolders,
  getWorkspaceFolderDisplayName,
} from "@/lib/recent-workspace-folders";
import { SuBanner } from "@/components/auth/su-banner";
import { MobileSubSectionTrigger } from "@/components/navbars/mobile-subsection-trigger";
import { MobileSubSectionLabel } from "@/components/navbars/mobile-subsection-label";
import { MobileNavLink } from "@/components/navbars/mobile-nav-link";
import { MobileDecoratedSubSection } from "@/components/navbars/mobile-decorated-subsection";
import { JobStatusPill } from "@/components/jobs/job-status-pill";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionTrigger({
  icon: Icon,
  count,
  children,
}: {
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 data-open:bg-secondary/5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary transition-colors group-hover:bg-secondary/20 group-data-open:bg-secondary/20">
        <Icon className="size-4" />
      </div>
      <span className="flex-1 text-left text-sm font-semibold text-foreground">
        {children}
      </span>
      {count != null && (
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
          {count}
        </span>
      )}
      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-open:rotate-180" />
    </CollapsibleTrigger>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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

  const totalServiceItems = Object.values(serviceItems).reduce(
    (n, s) => n + s.items.length,
    0,
  );
  const totalWorkspaceItems =
    workspaceNavItems.workspaces.items.length +
    workspaceNavItems.data.items.length +
    favoritePaths.length +
    recentFolders.length;

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

              <div className="relative bg-primary p-4 pb-5">
                <div className="flex items-start gap-1">
                  <Logo
                    variant="logo-white"
                    width={100}
                    height={40}
                    className="h-8 w-auto"
                    priority
                  />
                  <span className="mt-0.5 text-[10px] font-semibold text-white/70">
                    v{process.env.NEXT_PUBLIC_APP_VERSION}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-3 bg-linear-to-b from-primary to-transparent" />
              </div>

              <nav className="flex flex-col pb-6">
                {/* Organisms */}
                <Collapsible>
                  <SectionTrigger icon={Bug} count={organismItems.length}>
                    Organisms
                  </SectionTrigger>
                  <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                    <div className="flex flex-col px-5 pt-2 pb-3">
                      {organismItems.map((item) => (
                        <MobileNavLink key={item.href} href={item.href}>
                          {item.title}
                        </MobileNavLink>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="mx-4 h-px bg-border" />

                {/* Services */}
                <Collapsible>
                  <SectionTrigger icon={FlaskConical} count={totalServiceItems}>
                    Services
                  </SectionTrigger>
                  <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                    <div className="flex flex-col gap-1.5 px-5 pt-2 pb-3">
                      {(
                        Object.entries(serviceItems) as unknown as [
                          string,
                          NavSection,
                        ][]
                      ).map(([key, section]) => (
                        <Collapsible key={key} className="group/sub">
                          <MobileDecoratedSubSection>
                            <MobileSubSectionTrigger>
                              {section.title}
                            </MobileSubSectionTrigger>
                            <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                              <div className="flex flex-col pb-1">
                                {section.items.map((item) => (
                                  <MobileNavLink
                                    key={item.href}
                                    href={item.href}
                                    target={item.target}
                                  >
                                    {item.title}
                                  </MobileNavLink>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </MobileDecoratedSubSection>
                        </Collapsible>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="mx-4 h-px bg-border" />

                {/* Workspace */}
                <Collapsible>
                  <SectionTrigger icon={FolderOpen} count={totalWorkspaceItems}>
                    Workspace
                  </SectionTrigger>
                  <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                    <div className="flex flex-col gap-1.5 px-5 pt-2 pb-3">
                      <MobileDecoratedSubSection alwaysShow>
                        <MobileSubSectionLabel>
                          {workspaceNavItems.workspaces.title}
                        </MobileSubSectionLabel>
                        {workspaceNavItems.workspaces.items.map((item) => (
                          <MobileNavLink
                            key={item.title}
                            href={resolveWorkspaceHref(
                              item,
                              wsUsername,
                              isAuthenticated,
                            )}
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
                            href={resolveWorkspaceHref(
                              item,
                              wsUsername,
                              isAuthenticated,
                            )}
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
                            Favorites{" "}
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                          </MobileSubSectionLabel>
                          {favoritePaths.map((path) => (
                            <MobileNavLink
                              key={path}
                              href={buildFolderHref(path)}
                            >
                              {getWorkspaceFolderDisplayName(path)}
                            </MobileNavLink>
                          ))}
                        </MobileDecoratedSubSection>
                      )}

                      {isAuthenticated && recentFolders.length > 0 && (
                        <MobileDecoratedSubSection alwaysShow>
                          <MobileSubSectionLabel>
                            Recently Visited
                          </MobileSubSectionLabel>
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
                              variant: "default",
                              size: "sm",
                              className:
                                "bg-secondary hover:bg-secondary/90 w-fit",
                            })}
                          >
                            Sign In
                          </Link>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="mx-4 h-px bg-border" />

                {/* Resources */}
                <Collapsible>
                  <SectionTrigger icon={BookOpen} count={resourcesItems.length}>
                    Resources
                  </SectionTrigger>
                  <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                    <div className="flex flex-col px-5 pt-2 pb-3">
                      {resourcesItems.map((item) => (
                        <MobileNavLink
                          key={item.href}
                          href={item.href}
                          target={item.target}
                        >
                          {item.title}
                        </MobileNavLink>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </nav>
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
          <span className="mt-0 self-start text-[11px] font-semibold text-white/90 italic">
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
