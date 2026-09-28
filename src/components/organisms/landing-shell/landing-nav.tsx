"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type {
  OrganismLandingNavItem,
  OrganismViewKey,
} from "@/components/organisms/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LandingNavProps<Key extends string = OrganismViewKey> {
  items: readonly OrganismLandingNavItem<Key>[];
  activeView: Key;
  ariaLabel?: string;
  collapsed: boolean;
  onChange: (view: Key) => void;
  onCollapseToggle: () => void;
}

export function LandingNav<Key extends string>({
  items,
  activeView,
  ariaLabel = "Organism views",
  collapsed,
  onChange,
  onCollapseToggle,
}: LandingNavProps<Key>) {
  const [isMac] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
  );

  const shortcutKey = isMac ? "⌘B" : "Ctrl+B";

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-4 h-fit shrink-0 rounded-lg border bg-card text-card-foreground shadow-sm transition-[width] duration-150 ease-out",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex items-center justify-between gap-2 p-2.5">
        {!collapsed && (
          <h2 className="truncate pl-2 text-sm font-semibold text-muted-foreground">
            Views
          </h2>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={
                  collapsed
                    ? "Expand view navigation"
                    : "Collapse view navigation"
                }
                onClick={onCollapseToggle}
                className={collapsed ? "mx-auto" : "ml-auto"}
              >
                {collapsed ? <ChevronRight /> : <ChevronLeft />}
              </Button>
            }
          />
          <TooltipContent side="right">
            {collapsed ? "Expand" : "Collapse"} ({shortcutKey})
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-1 p-2.5 pt-0">
        {items.map((item) => {
          const isActive = item.key === activeView;
          const isDisabled = item.enabled === false;

          const buttonContent = (
            <>
              <span aria-hidden="true" className="flex shrink-0 items-center">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          );

          if (isDisabled) {
            const disabledButton = (
              <span
                key={item.key}
                tabIndex={0}
                aria-label={
                  item.disabledReason
                    ? `${item.label}: ${item.disabledReason}`
                    : item.label
                }
              >
                <Button
                  type="button"
                  tabIndex={-1}
                  variant={isActive ? "secondary" : "ghost"}
                  // size="nav" sets the semibold weight from aria-current and
                  // the muted text from aria-disabled.
                  size="nav"
                  aria-current={isActive ? "page" : undefined}
                  aria-disabled
                  title={item.disabledReason}
                  onClick={() => {
                    /* no-op: button is disabled */
                  }}
                  className="pointer-events-none cursor-not-allowed justify-start opacity-50"
                >
                  {buttonContent}
                </Button>
              </span>
            );

            if (!item.disabledReason) return disabledButton;

            return (
              <Tooltip key={item.key}>
                <TooltipTrigger render={disabledButton} />
                <TooltipContent side="right">
                  {item.disabledReason}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Button
              key={item.key}
              type="button"
              variant={isActive ? "secondary" : "ghost"}
              size="nav"
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => {
                onChange(item.key);
              }}
              className="justify-start"
            >
              {buttonContent}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
