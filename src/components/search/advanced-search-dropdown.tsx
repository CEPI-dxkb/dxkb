"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  advancedSearchTypes,
  advancedSearchHref,
} from "@/constants/search-info";

interface AdvancedSearchDropdownProps {
  variant?: "tab" | "button";
  className?: string;
  /**
   * Shows an icon in place of the label while the nearest `@container` ancestor is
   * narrower than `@md`. Only meaningful under such a container: with none, the
   * label would never show, so leave it off elsewhere.
   */
  collapsible?: boolean;
}

export function AdvancedSearchDropdown({
  variant = "tab",
  className,
  collapsible = false,
}: AdvancedSearchDropdownProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        variant={variant}
        className={className}
        title={collapsible ? "Advanced Search" : undefined}
      >
        {collapsible && (
          <SlidersHorizontal className="size-4 @md:hidden" aria-hidden />
        )}
        {collapsible ? (
          <span className="sr-only @md:not-sr-only">Advanced Search</span>
        ) : (
          "Advanced Search"
        )}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={variant === "tab" ? 0 : 4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Advanced Search</DropdownMenuLabel>
          {advancedSearchTypes.map((type) => (
            <DropdownMenuItem
              key={type.id}
              onClick={() => { router.push(advancedSearchHref(type.id)); }}
            >
              {type.typeTitle}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
