"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  Star,
  ChevronDown,
  Menu,
  Search,
  ChevronUp,
  ExternalLink,
  BookOpen,
  Bug,
  FlaskConical,
  FolderOpen,
} from "lucide-react";

import {
  gettingStartedItems,
  organismItems,
  serviceItems,
  workspaceNavItems,
} from "@/components/navbars/navbar-links";
import {
  workspaceUsername,
  resolveWorkspaceHref,
  buildFolderHref,
} from "@/components/navbars/workspace-dropdown-content";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import Logo from "@/components/ui/logo";
import { UserAvatarDropdown } from "@/components/navbars/user-avatar-dropdown";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import {
  getRecentFolders,
  getWorkspaceFolderDisplayName,
} from "@/lib/recent-workspace-folders";

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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary transition-colors group-hover:bg-secondary/20 group-data-open:bg-secondary/20">
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 text-left text-sm font-semibold text-foreground">
        {children}
      </span>
      {count != null && (
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
          {count}
        </span>
      )}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-open:rotate-180" />
    </CollapsibleTrigger>
  );
}

function SubSectionTrigger({ children }: { children: React.ReactNode }) {
  return (
    <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md py-2.5 pr-1 transition-colors hover:text-secondary">
      <span className="text-left text-[13px] font-semibold text-foreground/85 transition-colors group-hover:text-secondary group-data-open:text-foreground">
        {children}
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all duration-200 group-hover:text-secondary/60 group-data-open:rotate-180" />
    </CollapsibleTrigger>
  );
}

function SubSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center py-2.5">
      <span className="flex flex-1 items-center gap-1.5 text-[14px] font-semibold text-foreground/85">
        {children}
      </span>
    </div>
  );
}

function NavLink({
  href,
  target,
  children,
}: {
  href: string;
  target?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target={target}
      className="group/link flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground/75 transition-all hover:bg-secondary/8 hover:text-foreground"
    >
      {children}
      {target === "_blank" && (
        <ExternalLink className="h-3 w-3 text-muted-foreground transition-colors group-hover/link:text-secondary" />
      )}
    </Link>
  );
}

/**
 * Wraps a subsection with a dot + vertical line + curved bottom connector.
 * When `alwaysShow` is false the line/curve are hidden until the parent
 * `group/sub` collapsible opens.
 */
function DecoratedSubSection({
  children,
  alwaysShow = false,
  dotColor = alwaysShow ? "bg-secondary" : "bg-secondary/40 group-data-open/sub:bg-secondary",
  lineColor = "bg-secondary/25",
  curveColor = "border-secondary/25",
}: {
  children: React.ReactNode;
  alwaysShow?: boolean;
  dotColor?: string;
  lineColor?: string;
  curveColor?: string;
}) {
  const showClass = alwaysShow ? "" : "hidden group-data-open/sub:block";

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-[16px]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
          <div className={`mt-0.5 w-0.5 flex-1 ${lineColor} ${showClass}`} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div
        className={`ml-[2px] h-3 rounded-bl-xl border-b-2 border-l-2 ${curveColor} ${showClass}`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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
    <header className="bg-primary flex flex-col lg:hidden">
      <div className="flex items-center justify-between px-4 py-4 text-primary-foreground">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger
              render={(triggerProps) => (
                <Button
                  variant="ghost"
                  className="group hover:bg-white/15"
                  {...triggerProps}
                >
                  <Menu
                    className="scale-125 text-primary-foreground transition-all duration-300 group-hover:scale-150"
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
                <Logo
                  variant="logo-white"
                  width={100}
                  height={40}
                  className="h-8 w-auto"
                  priority
                />
                <div className="absolute inset-x-0 bottom-0 h-3 bg-linear-to-b from-primary to-transparent" />
              </div>

              <nav className="flex flex-col pb-6">
                {/* Getting Started */}
                <Collapsible>
                  <SectionTrigger icon={BookOpen} count={gettingStartedItems.length}>
                    Getting Started
                  </SectionTrigger>
                  <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                    <div className="flex flex-col px-5 pb-3 pt-2">
                      {gettingStartedItems.map((item) => (
                        <NavLink key={item.href} href={item.href} target={item.target}>
                          {item.title}
                        </NavLink>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="mx-4 h-px bg-border" />

                {/* Organisms */}
                <Collapsible>
                  <SectionTrigger icon={Bug} count={organismItems.length}>
                    Organisms
                  </SectionTrigger>
                  <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                    <div className="flex flex-col px-5 pb-3 pt-2">
                      {organismItems.map((item) => (
                        <NavLink key={item.href} href={item.href}>
                          {item.title}
                        </NavLink>
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
                    <div className="flex flex-col gap-1.5 px-5 pb-3 pt-2">
                      {Object.entries(serviceItems).map(([key, section]) => (
                        <Collapsible key={key} className="group/sub">
                          <DecoratedSubSection>
                            <SubSectionTrigger>{section.title}</SubSectionTrigger>
                            <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                              <div className="flex flex-col pb-1">
                                {section.items.map((item) => (
                                  <NavLink
                                    key={item.href}
                                    href={item.href}
                                    target={item.target}
                                  >
                                    {item.title}
                                  </NavLink>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </DecoratedSubSection>
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
                    {isLoading ? (
                      <div className="space-y-2 px-8 py-3">
                        <Skeleton className="h-5 w-24 bg-muted" />
                        <Skeleton className="h-5 w-32 bg-muted" />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 px-5 pb-3 pt-2">
                        <DecoratedSubSection alwaysShow>
                          <SubSectionLabel>
                            {workspaceNavItems.workspaces.title}
                          </SubSectionLabel>
                          {workspaceNavItems.workspaces.items.map((item) => (
                            <NavLink
                              key={item.title}
                              href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
                            >
                              {item.title}
                            </NavLink>
                          ))}
                        </DecoratedSubSection>

                        <DecoratedSubSection alwaysShow>
                          <SubSectionLabel>
                            {workspaceNavItems.data.title}
                          </SubSectionLabel>
                          {workspaceNavItems.data.items.map((item) => (
                            <NavLink
                              key={item.title}
                              href={resolveWorkspaceHref(item, wsUsername, isAuthenticated)}
                            >
                              {item.title}
                            </NavLink>
                          ))}
                        </DecoratedSubSection>

                        {isAuthenticated && favoritePaths.length > 0 && (
                          <DecoratedSubSection
                            alwaysShow
                            dotColor="bg-amber-400/50"
                            lineColor="bg-amber-400/25"
                            curveColor="border-amber-400/25"
                          >
                            <SubSectionLabel>
                              Favorites{" "}
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            </SubSectionLabel>
                            {favoritePaths.map((path) => (
                              <NavLink key={path} href={buildFolderHref(path)}>
                                {getWorkspaceFolderDisplayName(path)}
                              </NavLink>
                            ))}
                          </DecoratedSubSection>
                        )}

                        {isAuthenticated && recentFolders.length > 0 && (
                          <DecoratedSubSection alwaysShow>
                            <SubSectionLabel>Recently Visited</SubSectionLabel>
                            {recentFolders.map((folder) => (
                              <NavLink
                                key={folder.path}
                                href={buildFolderHref(folder.path)}
                              >
                                {getWorkspaceFolderDisplayName(folder.path)}
                              </NavLink>
                            ))}
                          </DecoratedSubSection>
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
                                className: "w-fit bg-secondary hover:bg-secondary/90",
                              })}
                            >
                              Sign In
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </nav>
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
          {!isHome && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-white/15"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              aria-label={isSearchOpen ? "Close search" : "Open search"}
            >
              {isSearchOpen ? <ChevronUp size={18} /> : <Search size={18} />}
            </Button>
          )}

          {isLoading && (
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-16 bg-white/20" />
              <Skeleton className="h-8 w-20 bg-white/20" />
            </div>
          )}

          {!isLoading && !isAuthenticated && (
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

          {!isLoading && isAuthenticated && <UserAvatarDropdown />}
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
    </header>
  );
};

export default MobileNavbar;
