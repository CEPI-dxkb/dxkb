"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/buttons/button";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RxAvatar } from "react-icons/rx";
import { useRouter } from "next/navigation";

function HoverDropdownMenu({
  trigger,
  children
}: {
  trigger: (isOpen: boolean) => React.ReactElement;
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} modal={false}>
      <div
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="relative"
      >
        <DropdownMenuTrigger asChild>
          {trigger(isOpen)}
        </DropdownMenuTrigger>
        <div className="absolute w-full h-4 -bottom-4" />
        <DropdownMenuContent className="w-48 mt-[-2px] pt-2">
          {children}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

const oldNavbarNoSearch = () => {
  const router = useRouter();

  return (
    <header className="bg-dxkb-blue text-white">
      <div className="w-full px-10 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link id="dxkb-logo" href="/">
            <Image
              src="/dxkb-logo-white-cropped.svg"
              alt="DXKB Logo"
              width={100}
              height={40}
              className="h-10 w-auto pr-8"
              priority
            />
          </Link>
          <nav className="hidden md:flex space-x-4">
            <HoverDropdownMenu
              trigger={(isOpen) => (
                <Button variant="ghost" className="flex items-center gap-1 text-md hover:transform hover:scale-105">
                  Organisms
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "[transform:rotateX(180deg)]" : ""}`} />
                </Button>
              )}
            >
              <DropdownMenuItem onClick={() => router.push("/viruses")}>
                Viruses
              </DropdownMenuItem>
              <DropdownMenuItem>Bacteria</DropdownMenuItem>
              <DropdownMenuItem>Fungi</DropdownMenuItem>
              <DropdownMenuItem>Browse All</DropdownMenuItem>
            </HoverDropdownMenu>

            <HoverDropdownMenu
              trigger={(isOpen) => (
                <Button variant="ghost" className="flex items-center gap-1 text-md hover:transform hover:scale-105">
                  Utilities
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </Button>
              )}
            >
              <DropdownMenuItem>BLAST Search</DropdownMenuItem>
              <DropdownMenuItem>Sequence Analysis</DropdownMenuItem>
              <DropdownMenuItem>Genome Assembly</DropdownMenuItem>
              <DropdownMenuItem>All Tools</DropdownMenuItem>
            </HoverDropdownMenu>

            <HoverDropdownMenu
              trigger={(isOpen) => (
                <Button variant="ghost" className="flex items-center gap-1 text-md hover:transform hover:scale-105">
                  Workspace
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </Button>
              )}
            >
              <DropdownMenuItem>My Projects</DropdownMenuItem>
              <DropdownMenuItem>Recent Analysis</DropdownMenuItem>
              <DropdownMenuItem>Saved Items</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </HoverDropdownMenu>
          </nav>
        </div>

        <Button variant="ghost" size="icon" className="group transition-all duration-300 h-10 w-10">
          <span className="sr-only">User account</span>
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              <RxAvatar className="h-6 w-6 text-gray-400 group-hover:text-black" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  )
};

export default oldNavbarNoSearch;