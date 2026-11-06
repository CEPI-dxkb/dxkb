"use client";

import { Palette } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeMenuOptions } from "@/components/navbars/theme-menu-options";

/**
 * The navbar's theme button for signed-out visitors. Signed-in users pick a
 * theme from the Theme submenu of the profile dropdown instead.
 */
export function NavbarThemeSwitcher() {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        variant="navbar-icon"
        aria-label="Open theme selector"
      >
        <Palette className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        sideOffset={8}
        align="end"
        className="w-56"
      >
        <ThemeMenuOptions />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
