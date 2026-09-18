"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  resourcesItems,
  organismItems,
  serviceItems,
  type NavSection,
} from "@/components/navbars/navbar-links";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { SearchBar } from "@/components/search/search-bar";
import { buttonVariants } from "@/components/ui/button-variants";
import Logo from "@/components/ui/logo";
import { useAuth } from "@/lib/auth/provider";
import { UserAvatarDropdown } from "@/components/navbars/user-avatar-dropdown";
import { WorkspaceDropdownContent } from "@/components/navbars/workspace-dropdown-content";
import { workspaceUsername } from "@/lib/services/workspace/path-utils";
import { SuBanner } from "@/components/auth/su-banner";
import { JobStatusPill } from "@/components/jobs/job-status-pill";
import { NavbarThemeSwitcher } from "@/components/navbars/theme-switcher-navbar";

const serviceEntries = Object.entries(serviceItems) as unknown as [
  string,
  NavSection,
][];
const serviceColumns = [
  serviceEntries.slice(0, Math.ceil(serviceEntries.length / 2)),
  serviceEntries.slice(Math.ceil(serviceEntries.length / 2)),
];

const DesktopNavbar = () => {
  const { isAuthenticated, user } = useAuth();
  const wsUsername = workspaceUsername(user);

  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="hidden flex-col bg-primary text-white lg:flex">
      <div className="flex h-18 items-center justify-between p-4">
        <div className="flex shrink-0 items-center space-x-2">
          <Link id="dxkb-logo-desktop" href="/" className="shrink-0">
            <Logo
              variant="logo-white"
              width={100}
              height={44}
              className="h-8 w-auto shrink-0"
              priority
            />
          </Link>
          <span className="mt-0 self-start text-[11px] font-semibold text-white/90 italic">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>

          <NavigationMenu className="hidden w-full items-center justify-between bg-primary font-bold lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem id="organisms-nav">
                <NavigationMenuTrigger className="bg-primary">
                  Organisms
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-56 gap-3 p-4">
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
                  <div className="grid grid-cols-2 gap-2 p-2 lg:w-140">
                    {serviceColumns.map((column, colIdx) => (
                      <div key={colIdx} className="space-y-0">
                        {column.map(([key, section]) => (
                          <div key={key}>
                            <h4 className="my-0.5 rounded-md bg-primary p-2 text-sm font-bold text-white">
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
                                        aria-label={`${item.title} (opens in a new tab)`}
                                        className="my-0.5 block p-2 font-medium hover:bg-secondary/20"
                                      />
                                    ) : (
                                      <Link
                                        href={item.href}
                                        className="my-0.5 block p-2 font-medium hover:bg-secondary/20"
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
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem id="workspace-nav">
                <NavigationMenuTrigger className="bg-primary">
                  Workspace
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <WorkspaceDropdownContent
                    isAuthenticated={isAuthenticated}
                    wsUsername={wsUsername}
                  />
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem id="resources-nav">
                <NavigationMenuTrigger className="bg-primary">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-100 gap-3 p-4 md:w-125 md:grid-cols-2 lg:w-125">
                    {resourcesItems.map((item) => (
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
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {!isHome && (
          <div className="hidden flex-1 items-center justify-end px-2 lg:flex">
            <SearchBar className="max-w-250" />
          </div>
        )}

        <div className="flex items-center space-x-2">
          <NavbarThemeSwitcher />
          <div className="flex items-center space-x-2">
            {!isAuthenticated && (
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
                    className:
                      "text-foreground hover:text-secondary hover:bg-white",
                  })}
                >
                  Sign Up
                </Link>
              </>
            )}

            {isAuthenticated && (
              <>
                <JobStatusPill />
                <UserAvatarDropdown />
              </>
            )}
          </div>
        </div>
      </div>
      <SuBanner />
    </header>
  );
};

function ListItem({
  title,
  children,
  href,
  target,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & {
  href: string;
  target?: "_self" | "_blank";
}) {
  return (
    <li {...props}>
      <NavigationMenuLink render={<Link href={href} target={target} />}>
        <div className="flex flex-col gap-1 text-sm">
          <div className="leading-none font-medium">{title}</div>
          <div className="line-clamp-2 text-muted-foreground">{children}</div>
        </div>
      </NavigationMenuLink>
    </li>
  );
}

export default DesktopNavbar;
