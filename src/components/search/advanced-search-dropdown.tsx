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

interface AdvancedSearchDropdownProps {
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
      <DropdownMenuTrigger variant={variant} className={className}>
        Advanced Search
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
