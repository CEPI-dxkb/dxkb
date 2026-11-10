"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { viewLabel, type PickerView } from "@/lib/services/workspace/picker-views";
import { cn } from "@/lib/utils";
import { placeIcons } from "./folder-picker-utils";

// No `duration-*` here: in Tailwind v4 it also sets `transition-duration`, which made
// crumbs transition their layout whenever they changed role.
const crumbEnterClass =
  "ease-out animate-in fade-in-0 slide-in-from-right-2 motion-reduce:animate-none";

export function FolderPickerBreadcrumb({
  place,
  chain,
  label,
  navLabel,
  disabled,
  onJump,
}: {
  place: PickerView;
  chain: string[];
  label: (path: string) => string;
  navLabel: string;
  disabled: boolean;
  onJump: (depth: number) => void;
}) {
  const PlaceIcon = placeIcons[place];
  const trailRef = useRef<HTMLElement>(null);

  // Before paint, so a new crumb never shows a frame scrolled out of view.
  useLayoutEffect(() => {
    const trail = trailRef.current;
    if (trail) trail.scrollLeft = trail.scrollWidth;
  }, [place, chain]);

  return (
    <nav
      ref={trailRef}
      aria-label={navLabel}
      className="-m-1 no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto p-1"
    >
      <ol className="flex min-w-0 items-center gap-0.5 text-sm">
        <li
          key={place}
          className={cn("flex shrink-0 items-center", crumbEnterClass)}
        >
          <CrumbButton
            isCurrent={chain.length === 0}
            disabled={disabled}
            onClick={() => {
              onJump(0);
            }}
          >
            <PlaceIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{viewLabel(place)}</span>
          </CrumbButton>
        </li>
        {chain.map((path, position) => {
          const depth = position + 1;
          const isLast = depth === chain.length;
          return (
            <li
              key={path}
              className={cn(
                "flex items-center gap-0.5",
                crumbEnterClass,
                isLast ? "max-w-64 min-w-0 shrink-0" : "min-w-12",
              )}
            >
              <ChevronRight
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <CrumbButton
                isCurrent={isLast}
                title={path}
                disabled={disabled}
                onClick={() => {
                  onJump(depth);
                }}
              >
                <span className="truncate">{label(path)}</span>
              </CrumbButton>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CrumbButton({
  isCurrent,
  title,
  disabled,
  onClick,
  children,
}: {
  isCurrent: boolean;
  title?: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={isCurrent ? "location" : undefined}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 transition-colors duration-150 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        isCurrent
          ? "font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
