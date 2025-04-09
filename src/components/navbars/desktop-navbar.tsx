"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/buttons/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RxAvatar } from "react-icons/rx"
import { cn } from "@/lib/utils"


import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

const organisms: { title: string; href: string; description: string }[] = [
  {
    title: "Viruses",
    href: "/organisms/viruses",
    description:
      "Webpage for all viruses.",
  },
  {
    title: "Bacteria",
    href: "/organisms/bacteria",
    description:
      "Webpage for all bacteria.",
  },
  {
    title: "Fungi",
    href: "/organisms/fungi",
    description:
      "Webpage for all fungi.",
  },
  {
    title: "Browse All",
    href: "/organisms/all",
    description:
      "Webpage for all organisms.",
  },
]

const utilities: { title: string; href: string; description: string }[] = [
  {
    title: "BLAST Search",
    href: "/utilities/blast",
    description:
      "Webpage for BLAST search.",
  },
  {
    title: "Sequence Analysis",
    href: "/utilities/sequence-analysis",
    description:
      "Webpage for sequence analysis.",
  },
  {
    title: "Genome Assembly",
    href: "/utilities/genome-assembly",
    description:
      "Webpage for genome assembly.",
  },
  {
    title: "All Utilities",
    href: "/utilities/all",
    description:
      "Webpage for all utilities.",
  },
]

const DesktopNavbar = () => {
  return (
    <header className="hidden md:flex bg-primary-def text-white justify-between items-center px-8 py-4">
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

        <NavigationMenu className="hidden md:flex bg-primary-def w-full justify-between items-center font-bold">
          <NavigationMenuList>
            <NavigationMenuItem id="getting-started-nav">
              <NavigationMenuTrigger className="bg-primary-def">Getting started</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 p-6 no-underline outline-none focus:shadow-md bg-primary-def hover:bg-primary-def/80 transition-all duration-300"
                        href="/"
                      >
                        <Image src="/logos/dxkb-logo-white-cropped.svg" alt="DXKB Logo" width={100} height={40} />
                        <div className="mb-2 mt-4 text-lg font-medium text-white">
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
                  <ListItem href="/docs" title="Introduction">
                    Re-usable components built using Radix UI and Tailwind CSS.
                  </ListItem>
                  <ListItem href="/docs/installation" title="Installation">
                    How to install dependencies and structure your app.
                  </ListItem>
                  <ListItem href="https://docs.dxkb.org" title="Documentation">
                    Documentation for DXKB and its related tools/services.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem id="organisms-nav">
              <NavigationMenuTrigger className="bg-primary-def">Organisms</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                  {organisms.map((organism) => (
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

            <NavigationMenuItem id="utilities-nav">
              <NavigationMenuTrigger className="bg-primary-def">Utilities</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-2 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                  {utilities.map((utility) => (
                    <ListItem
                      key={utility.title}
                      title={utility.title}
                      href={utility.href}
                    >
                      {utility.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <Button variant="ghost" size="icon" className="group transition-all duration-300 h-10 w-10">
        <span className="sr-only">User account</span>
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            <RxAvatar className="h-6 w-6 text-gray-400 group-hover:text-black" />
          </AvatarFallback>
        </Avatar>
      </Button>
    </header>
  )
}

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
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = "ListItem"

export default DesktopNavbar;