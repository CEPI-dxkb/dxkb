"use client";

import * as React from "react";
import Link from "next/link";
import {
  gettingStartedItems,
  organismItems,
  serviceItems,
} from "./navbar-links";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/buttons/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/logo";
import { useAuth } from "@/contexts/auth-context";
import { LogoutButton } from "../auth/logout-button";
import {
  UserRound,
  Settings,
  NotebookPen,
  BriefcaseBusiness,
  Mail,
} from "lucide-react";

const DesktopNavbar = () => {
  const { isAuthenticated, user, isLoading, sendVerificationEmail } = useAuth();

  return (
    <header className="bg-primary hidden h-18 items-center justify-between px-4 py-4 text-white md:flex">
      <div className="flex items-center space-x-2">
        <Link id="dxkb-logooooo" href="/">
          <Logo
            variant="logo-white"
            width={100}
            height={44}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <NavigationMenu className="bg-primary hidden w-full items-center justify-between font-bold md:flex">
          <NavigationMenuList>
            <NavigationMenuItem id="getting-started-nav">
              <NavigationMenuTrigger className="bg-primary">
                Getting started
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <Link
                        className="from-muted/50 bg-primary hover:bg-primary/80 flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline transition-all duration-300 outline-none select-none focus:shadow-md"
                        href="/"
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
                      </Link>
                    </NavigationMenuLink>
                  </li>
                  {gettingStartedItems.map((item) => (
                    <ListItem
                      key={item.title}
                      title={item.title}
                      href={item.href}
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
                                href={item.href}
                                target={item.target}
                                className="hover:bg-secondary/20 my-0.5 block p-2 font-medium"
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
                                href={item.href}
                                target={item.target}
                                className="hover:bg-secondary/20 my-0.5 block p-2 font-medium"
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
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          {/* Show skeleton while loading */}
          {isLoading && (
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-16 bg-white/20" />
              <Skeleton className="h-8 w-20 bg-white/20" />
            </div>
          )}

          {/* Show login/register when NOT authenticated and not loading */}
          {!isLoading && !isAuthenticated && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/login">Login</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-foreground hover:text-secondary hover:bg-white"
                asChild
              >
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}

          {/* Show user info and logout when authenticated and not loading */}
          {!isLoading && isAuthenticated && (
            <>
              <div className="hover:bg-foreground/10 flex items-center space-x-2 rounded-md px-1 py-1">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-white/10 text-white">
                          {user?.username?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" sideOffset={8} align="end">
                    <DropdownMenuLabel>User Actions</DropdownMenuLabel>

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
                          <Link href="/">My Workspace</Link>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span className="flex items-center gap-2">
                          <BriefcaseBusiness className="text-foreground h-4 w-4" />
                          <Link href="/">My Jobs</Link>
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
                            className="text-foreground p-0 font-inherit cursor-pointer h-5"
                          >
                            Resend Verification Email
                          </Button>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <LogoutButton className="bg-popover group-hover:bg-accent m-0 w-full justify-start border-none p-0 shadow-none" />
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const ListItem = React.forwardRef<
  React.ComponentRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "hover:bg-accent/50 hover:text-accent-foreground focus:bg-accent/50 focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none",
            className,
          )}
          {...props}
        >
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export default DesktopNavbar;
