"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  id: string;
  label: string;
  value: string;
  description: string;
  href?: string;
  testId?: string;
  className?: string;
  valueClassName?: string;
}

// `grow` fills the Card (a flex column that stretches to its row's tallest tile), so the clickable area covers the whole tile.
const bodyClassName =
  "block min-w-0 grow px-2.5 py-1.5 focus-visible:outline-hidden";

export function StatTile({
  id,
  label,
  value,
  description,
  href,
  testId,
  className,
  valueClassName,
}: StatTileProps) {
  const descriptionId = `stat-tile-${id}-description`;
  const body = (
    <>
      <p className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "text-lg leading-tight font-bold tracking-tight",
          valueClassName,
        )}
      >
        {value}
      </p>
    </>
  );

  return (
    <Card
      data-testid={testId}
      variant={href ? "tile-link" : "tile"}
      className={cn("gap-0 p-0", className)}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            href ? (
              <Link
                href={href}
                prefetch={false}
                data-slot="stat-tile-link"
                aria-describedby={descriptionId}
                className={bodyClassName}
              />
            ) : (
              <div className={bodyClassName} />
            )
          }
        >
          {body}
        </TooltipTrigger>
        <TooltipContent side="top">{description}</TooltipContent>
      </Tooltip>
      <span id={descriptionId} className="sr-only">
        {description}
      </span>
    </Card>
  );
}
