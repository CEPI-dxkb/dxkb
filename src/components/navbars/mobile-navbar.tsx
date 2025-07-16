"use client";

import { Button } from "@/components/buttons/button";
import { LuMenu } from "react-icons/lu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  gettingStartedItems,
  organismItems,
  serviceItems,
} from "./navbar-links";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import { useAuth } from "@/contexts/auth-context";
import { LogoutButton } from "../auth/logout-button";

const MobileNavbar = () => {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  return (
    <header className="bg-primary flex items-center justify-between px-4 py-4 text-foreground md:hidden">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild className="group hover:bg-gray-300/50">
            <Button variant="ghost">
              <LuMenu className="scale-125 text-foreground transition-all duration-300 group-hover:scale-150 group-hover:text-white" />
            </Button>
          </SheetTrigger>
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

              {/* Workspace Section - only show when authenticated */}
              {isAuthenticated && (
                <div className="p-3">
                  <h2 className="mobile-nav-section-header">Workspace</h2>
                  <div className="grid grid-cols-1 gap-y-1">
                    <Link
                      href="/workspace"
                      className="mobile-nav-link"
                    >
                      My Jobs
                    </Link>
                  </div>
                </div>
              )}
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
              className="text-foreground hover:bg-gray-300/50"
              asChild
            >
              <Link href="/login">Login</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-foreground text-foreground hover:bg-foreground hover:text-background"
              asChild
            >
              <Link href="/register">Register</Link>
            </Button>
          </>
        )}

        {/* Show user info and logout when authenticated and not loading */}
        {!isLoading && isAuthenticated && (
          <>
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-white/10 text-white">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-white">{user?.username}</span>
            </div>
            <LogoutButton />
          </>
        )}
      </div>
    </header>
  );
};

export default MobileNavbar;
