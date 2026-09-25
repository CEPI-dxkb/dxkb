"use client";

import { ChevronUp, LayoutGrid } from "lucide-react";
import { useState } from "react";

import type {
  OrganismLandingNavItem,
  OrganismViewKey,
} from "@/components/organisms/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { cn } from "@/lib/utils";

interface LandingMobileNavProps<Key extends string = OrganismViewKey> {
  items: readonly OrganismLandingNavItem<Key>[];
  activeView: Key;
  onChange: (view: Key) => void;
}

/**
 * Mobile organism-view navigation: a floating bottom-center pill that opens a
 * bottom sheet of view tiles. Replaces the desktop "Views" rail below `lg`.
 * The pill hides on scroll-down and reveals on scroll-up; it stays visible
 * while the sheet is open and whenever it (or a child) holds focus, so
 * keyboard users can always reach it.
 */
export function LandingMobileNav<Key extends string>({
  items,
  activeView,
  onChange,
}: LandingMobileNavProps<Key>) {
  const [open, setOpen] = useState(false);
  const active = items.find((item) => item.key === activeView) ?? items[0];
  const hidden = useHideOnScroll(open);

  function select(key: Key) {
    onChange(key);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-all duration-300 ease-out",
          "has-focus-visible:pointer-events-auto has-focus-visible:translate-y-0 has-focus-visible:opacity-100",
          hidden
            ? "pointer-events-none translate-y-24 opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        <SheetTrigger
          render={(triggerProps) => (
            <Button
              variant="default"
              // Explicit name: the pill animates to opacity-0 on scroll-down,
              // where axe treats the visible text as absent — the label keeps
              // the trigger named for assistive tech in every state.
              aria-label={`Views: ${active.label}`}
              className="h-12 gap-2 rounded-full border border-background/10 bg-foreground pr-3 pl-4 text-background shadow-2xl hover:bg-foreground/90"
              {...triggerProps}
            >
              <LayoutGrid
                aria-hidden="true"
                className="size-4 text-background/60"
              />
              <span className="text-3xs font-bold tracking-widest text-background/50 uppercase">
                Views
              </span>
              <span className="font-semibold">{active.label}</span>
              <ChevronUp
                aria-hidden="true"
                className="size-4 text-background/60"
              />
            </Button>
          )}
        />
      </div>
      <SheetContent
        side="bottom"
        className="max-h-[75vh] gap-0 rounded-t-2xl p-0"
      >
        <SheetTitle className="px-4 pt-4 pb-2 text-sm font-semibold text-muted-foreground">
          Views
        </SheetTitle>
        <div className="grid grid-cols-4 gap-1.5 overflow-y-auto p-3 pb-8">
          {items.map((item) => {
            const isActive = item.key === activeView;
            const isDisabled = item.enabled === false;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-disabled={isDisabled || undefined}
                title={isDisabled ? item.disabledReason : undefined}
                onClick={() => {
                  if (isDisabled) return;
                  select(item.key);
                }}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border p-1 text-center transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-card text-foreground hover:bg-muted/50",
                  isDisabled && "cursor-not-allowed opacity-40 hover:bg-card",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex items-center [&_svg]:size-5"
                >
                  {item.icon}
                </span>
                <span className="text-3xs leading-tight font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
