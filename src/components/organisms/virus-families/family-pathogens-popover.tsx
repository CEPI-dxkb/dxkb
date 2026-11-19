"use client";

import { Info } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FamilyPathogensPopoverProps {
  familyName: string;
  pathogens: { name: string; href: string }[];
  /** Shown in place of the list when `pathogens` is empty. */
  note?: string;
}

export function FamilyPathogensPopover({
  familyName,
  pathogens,
  note,
}: FamilyPathogensPopoverProps) {
  const label = `Major human pathogens in ${familyName}`;

  return (
    <div className="flex shrink-0 items-center pr-2">
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={150}
          render={
            <Button
              type="button"
              variant="ghost-accent"
              size="icon-sm"
              aria-label={label}
            />
          }
        >
          <Info />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end">
          <PopoverHeader>
            <PopoverTitle>{label}</PopoverTitle>
          </PopoverHeader>
          {pathogens.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {pathogens.map((pathogen) => (
                <li key={pathogen.href}>
                  <Link
                    href={pathogen.href}
                    className="text-link underline underline-offset-2 dark:hover:text-foreground"
                  >
                    {pathogen.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{note}</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
