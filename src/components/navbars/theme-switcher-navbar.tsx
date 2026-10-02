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
        render={
          <button
            aria-label="Open theme selector"
            className="relative flex size-8 items-center justify-center rounded-full border border-white/30 text-white/80 transition-all duration-200 hover:border-white hover:bg-white/10 hover:text-white data-popup-open:border-white data-popup-open:bg-white/15 data-popup-open:text-white"
          />
        }
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
