"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/buttons/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RxAvatar } from "react-icons/rx";
import { cn } from "@/lib/utils";
import { gettingStartedItems, organismItems, serviceItems } from "./navbar-links";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const DesktopNavbar = () => {
  return (
    <header className="bg-primary-def hidden items-center justify-between px-8 py-4 text-white md:flex">
      <div className="flex items-center space-x-4">
        <Link id="dxkb-logo" href="/">
          <Image
            src="/logos/dxkb-logo-white-cropped.svg"
            alt="DXKB Logo"
            width={100}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <NavigationMenu className="bg-primary-def hidden w-full items-center justify-between font-bold md:flex">
          <NavigationMenuList>
            <NavigationMenuItem id="getting-started-nav">
              <NavigationMenuTrigger className="bg-primary-def">
                Getting started
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="from-muted/50 bg-primary-def hover:bg-primary-def/80 flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline transition-all duration-300 outline-none select-none focus:shadow-md"
                        href="/"
                      >
                        <Image
                          src="/logos/dxkb-logo-white-cropped.svg"
                          alt="DXKB Logo"
                          width={100}
                          height={40}
                        />
                        <div className="mt-4 mb-2 text-lg font-medium text-white">
                          shadcn/ui
                        </div>
                        <p className="text-sm leading-tight text-white">
                          Beautifully designed components that you can copy and
                          paste into your apps. Accessible. Customizable. Open
                          Source.
                        </p>
                      </a>
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
              <NavigationMenuTrigger className="bg-primary-def">
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
              <NavigationMenuTrigger className="bg-primary-def">
                Services
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[650px] grid-cols-2 gap-2 p-2">
                  <div className="space-y-0">
                    {/* Left Column */}
                    {Object.entries(serviceItems)
                      .slice(
                        0,
                        Math.ceil(Object.keys(serviceItems).length / 2),
                      )
                      .map(([key, section]) => (
                        <div key={key}>
                          <h4 className="bg-primary-def my-0.5 rounded-md p-2 text-sm font-bold text-white">
                            {section.title}
                          </h4>
                          <div className="space-y-0">
                            {section.items.map((item) => (
                              <NavigationMenuLink
                                key={item.href}
                                href={item.href}
                                target={item.target}
                                className="hover:bg-secondary-100 my-0.5 block p-2 font-medium"
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
                      .slice(
                        Math.ceil(Object.keys(serviceItems).length / 2),
                      )
                      .map(([key, section]) => (
                        <div key={key}>
                          <h4 className="bg-primary-def my-0.5 rounded-md p-2 text-sm font-bold text-white">
                            {section.title}
                          </h4>
                          <div className="space-y-0">
                            {section.items.map((item) => (
                              <NavigationMenuLink
                                key={item.href}
                                href={item.href}
                                target={item.target}
                                className="hover:bg-secondary-100 my-0.5 block p-2 font-medium"
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

      <Button
        variant="ghost"
        size="icon"
        className="group h-10 w-10 transition-all duration-300"
      >
        <span className="sr-only">User account</span>
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            <RxAvatar className="h-6 w-6 text-gray-400 group-hover:text-black" />
          </AvatarFallback>
        </Avatar>
      </Button>
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
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none",
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
