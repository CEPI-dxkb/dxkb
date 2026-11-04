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
import { ChevronDown } from "lucide-react";
import {
  advancedSearchTypes,
  advancedSearchHref,
} from "@/constants/search-info";
import { cn } from "@/lib/utils";

interface AdvancedSearchDropdownProps {
  /** Visual style: "tab" renders as a tab-shaped trigger; "button" renders as a segmented button */
  variant?: "tab" | "button";
  className?: string;
}

export function AdvancedSearchDropdown({
  variant = "tab",
  className,
}: AdvancedSearchDropdownProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          variant === "tab" &&
            "inline-flex items-center gap-1 rounded-t-md border border-b-0 border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-open:bg-accent data-open:text-accent-foreground",
          variant === "button" &&
            "inline-flex h-9 shrink-0 items-center gap-1 rounded-r-md border border-l-0 border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-open:bg-accent data-open:text-accent-foreground",
          className,
        )}
      >
        Advanced Search
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={variant === "tab" ? 0 : 4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Advanced Search</DropdownMenuLabel>
          {advancedSearchTypes.map((type) => (
            <DropdownMenuItem
              key={type.id}
              onClick={() => router.push(advancedSearchHref(type.id))}
            >
              {type.typeTitle}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
