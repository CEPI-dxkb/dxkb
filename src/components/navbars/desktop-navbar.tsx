"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { gettingStartedItems, organismItems, serviceItems } from "@/components/navbars/navbar-links";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { SearchBar } from "@/components/search/search-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import Logo from "@/components/ui/logo";
import { useAuth } from "@/contexts/auth-context";
import { SignoutButton } from "@/components/auth/signout-button";
import {DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { UserRound, Settings, NotebookPen, BriefcaseBusiness, Mail } from "lucide-react";
import { encodeWorkspaceSegment } from "@/lib/utils";

/** Full username with @domain for workspace URLs (session stores short form in user.username). */
function workspaceUsername(user: { username?: string; realm?: string } | null): string {
  if (!user?.username) return "";
  return user.realm ? `${user.username}@${user.realm}` : user.username;
}

const DesktopNavbar = () => {
  const { isAuthenticated, user, isLoading, sendVerificationEmail } = useAuth();
  const wsUsername = workspaceUsername(user);

  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <header className="bg-primary hidden h-18 items-center justify-between px-4 py-4 text-white lg:flex">
      <div className="flex items-center space-x-2 shrink-0">
        <Link id="dxkb-logo" href="/" className="shrink-0">
          <Logo
            variant="logo-white"
            width={100}
            height={44}
            className="h-8 w-auto shrink-0"
            priority
          />
        </Link>

        <NavigationMenu className="bg-primary hidden w-full items-center justify-between font-bold lg:flex">
          <NavigationMenuList>
            <NavigationMenuItem id="getting-started-nav">
              <NavigationMenuTrigger className="bg-primary">
                Getting started
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink
                      render={
                        <Link
                          className="from-muted/50 bg-primary hover:bg-primary/80 flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline transition-all duration-300 outline-none select-none focus:shadow-md"
                          href="/"
                        />
                      }
                    >
                      <Logo variant="logo-white" />
                      <div className="mt-4 mb-2 text-lg font-medium text-white">
                        shadcn/ui
                      </div>
                      <p className="text-sm leading-tight text-white">
                        Beautifully designed components that you can copy and
                        paste into your apps. Accessible. Customizable. Open
                        Source.
                      </p>
                    </NavigationMenuLink>
                  </li>
                  {gettingStartedItems.map((item) => (
                    <ListItem
                      key={item.title}
                      title={item.title}
                      href={item.href}
                      target={item.target}
                    >
                      {item.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem id="organisms-nav">
              <NavigationMenuTrigger className="bg-primary">
                Organisms
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                  {organismItems.map((organism) => (
                    <ListItem
                      key={organism.title}
                      title={organism.title}
                      href={organism.href}
                      target={organism.target}
                    >
                      {organism.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem id="services-nav">
              <NavigationMenuTrigger className="bg-primary">
                Services
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid grid-cols-2 gap-2 p-2 md:w-[550px] lg:w-[650px]">
                  <div className="space-y-0">
                    {/* Left Column */}
                    {Object.entries(serviceItems)
                      .slice(0, Math.ceil(Object.keys(serviceItems).length / 2))
                      .map(([key, section]) => (
                        <div key={key}>
                          <h4 className="bg-primary my-0.5 rounded-md p-2 text-sm font-bold text-white">
                            {section.title}
                          </h4>
                          <div className="space-y-0">
                            {section.items.map((item) => (
                              <NavigationMenuLink
                                key={item.href}
                                render={
                                  item.target === "_blank" ? (
                                    <a
                                      href={item.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:bg-secondary/20 my-0.5 block p-2 font-medium"
                                    />
                                  ) : (
                                    <Link
                                      href={item.href}
                                      className="hover:bg-secondary/20 my-0.5 block p-2 font-medium"
                                    />
                                  )
                                }
                              >
                                {item.title}
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="space-y-0">
                    {/* Right Column */}
                    {Object.entries(serviceItems)
                      .slice(Math.ceil(Object.keys(serviceItems).length / 2))
                      .map(([key, section]) => (
                        <div key={key}>
                          <h4 className="bg-primary my-0.5 rounded-md p-2 text-sm font-bold text-white">
                            {section.title}
                          </h4>
                          <div className="space-y-0">
                            {section.items.map((item) => (
                              <NavigationMenuLink
                                key={item.href}
                                render={
                                  item.target === "_blank" ? (
                                    <a
                                      href={item.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:bg-secondary/20 my-0.5 block p-2 font-medium"
                                    />
                                  ) : (
                                    <Link
                                      href={item.href}
                                      className="hover:bg-secondary/20 my-0.5 block p-2 font-medium"
                                    />
                                  )
                                }
                              >
                                {item.title}
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Workspace - always visible; when not signed in, prompt to Sign In */}
            <NavigationMenuItem id="workspace-nav">
              <NavigationMenuTrigger className="bg-primary">
                Workspace
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                {isAuthenticated ? (
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <ListItem
                      key="workspace-nav"
                      title="My Workspace"
                      href={wsUsername ? `/workspace/${encodeWorkspaceSegment(wsUsername)}/home` : "/workspace"}
                    >
                      View your workspace.
                    </ListItem>
                    <ListItem
                      key="workspace-jobs-nav"
                      title="Jobs"
                      href="/jobs"
                    >
                      View all jobs in your workspace.
                    </ListItem>
                  </ul>
                ) : (
                  <ul className="grid w-[300px] gap-3 p-4 md:w-[400px] md:grid-cols-2 lg:w-[500px]">
                    <ListItem
                      key="workspace-sign-in"
                      title="My Workspace"
                      href="/sign-in?redirect=/workspace"
                      className="w-full"
                    >
                      Sign in required
                    </ListItem>
                    <ListItem
                      key="jobs-sign-in"
                      title="My Jobs"
                      href="/sign-in?redirect=/jobs"
                      className="w-full"
                    >
                      Sign in required
                    </ListItem>
                  </ul>
                )}
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        </div>

        {!isHome && (
          <div className="hidden lg:flex flex-1 items-center justify-end px-2">
            <SearchBar className="w-full" />
          </div>
        )}
                      
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
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
                  className: "text-white hover:bg-white/10 hover:text-white",
                })}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "text-foreground hover:text-secondary hover:bg-white",
                })}
              >
                Sign Up
              </Link>
            </>
          )}

          {/* Show user info and signout when authenticated and not loading */}
          {!isLoading && isAuthenticated && (
            <>
              <div className="hover:bg-foreground/10 flex items-center space-x-2 rounded-md px-1 py-1">
                <div className="size-8 shrink-0 overflow-hidden rounded-full **:data-[slot=dropdown-menu-trigger]:size-full **:data-[slot=dropdown-menu-trigger]:min-w-0">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger
                      nativeButton={false}
                      render={<div className="flex size-full items-center justify-center" />}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-white/10 text-white">
                          {user?.username?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" sideOffset={8} align="end" className="w-[200px]">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        <span className="flex items-center gap-2">
                          <UserRound className="text-foreground h-2 w-2" />
                          <Link href="/">Profile</Link>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span className="flex items-center gap-2">
                          <NotebookPen className="text-foreground h-4 w-4" />
                          <Link href={wsUsername ? `/workspace/${encodeWorkspaceSegment(wsUsername)}/home` : "/workspace"}>My Workspace</Link>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span className="flex items-center gap-2">
                          <BriefcaseBusiness className="text-foreground h-4 w-4" />
                          <Link href="/jobs">My Jobs</Link>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span className="flex items-center gap-2">
                          <Settings className="text-foreground h-4 w-4" />
                          <Link href="/">Settings</Link>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span className="flex items-center gap-2">
                          <Mail className="text-foreground h-4 w-4" />
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => sendVerificationEmail()}
                            className="text-foreground font-inherit h-5 cursor-pointer p-0"
                          >
                            Resend Verification Email
                          </Button>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <SignoutButton className="bg-popover group-hover:bg-accent m-0 w-full justify-start border-none p-0 shadow-none" />
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

function ListItem({
  title,
  children,
  href,
  target,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string; target?: "_self" | "_blank" }) {
  return (
    <li {...props}>
      <NavigationMenuLink render={<Link href={href} target={target} />}>
        <div className="flex flex-col gap-1 text-sm">
          <div className="leading-none font-medium">{title}</div>
          <div className="text-muted-foreground line-clamp-2">{children}</div>
        </div>
      </NavigationMenuLink>
    </li>
  )
}

export default DesktopNavbar;
