"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { stateViewUnavailableReason } from "./county-availability";
import type { GeoMapState, GeoMapView } from "./types";

interface StateOption {
  fips: string;
  name: string;
}

interface MapControlsProps {
  mapState: GeoMapState;
  stateOptions: StateOption[];
  stateViewAvailable: boolean;
  onViewChange: (view: GeoMapView) => void;
  onSelectState: (fips: string, name: string) => void;
}

export function MapControls({
  mapState,
  stateOptions,
  stateViewAvailable,
  onViewChange,
  onSelectState,
}: MapControlsProps) {
  const isStateView = mapState.view === "state";
  const stateSelectShown = isStateView && stateOptions.length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
          <PillButton active={mapState.view === "world"} onClick={() => { onViewChange("world"); }}>
            World
          </PillButton>
          <PillButton active={mapState.view === "us"} onClick={() => { onViewChange("us"); }}>
            United States
          </PillButton>
          <PillButton
            active={isStateView}
            onClick={() => { onViewChange("state"); }}
            unavailableReason={stateViewAvailable ? undefined : stateViewUnavailableReason}
          >
            State
          </PillButton>
        </div>

        {/* Hidden by max-width and opacity, which leave it in the tab order, so
            it is inert too: a keyboard user must not pick a state from it. */}
        <div
          inert={!stateSelectShown}
          className={cn(
            "overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out",
            stateSelectShown ? "max-w-55 opacity-100" : "pointer-events-none max-w-0 opacity-0",
          )}
        >
          <Select
            items={stateOptions.map((option) => ({ value: option.fips, label: option.name }))}
            value={mapState.selectedStateFips ?? ""}
            onValueChange={(value) => {
              if (!value) return;
              const option = stateOptions.find((o) => o.fips === value);
              if (option) onSelectState(option.fips, option.name);
            }}
          >
            <SelectTrigger density="compact" className="h-7 min-w-40" aria-label="View state">
              <SelectValue placeholder="View state…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {stateOptions.map((option) => (
                  <SelectItem key={option.fips} value={option.fips}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

      </div>
    </TooltipProvider>
  );
}

interface PillButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Why the pill cannot be used. A value disables the pill and explains it. */
  unavailableReason?: string;
}

function PillButton({
  active,
  onClick,
  children,
  unavailableReason,
}: PillButtonProps) {
  const reasonId = useId();
  const button = (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="xs"
      aria-pressed={active}
      disabled={unavailableReason !== undefined}
      aria-describedby={unavailableReason === undefined ? undefined : reasonId}
      onClick={onClick}
      className={cn(active && "shadow-sm")}
    >
      {children}
    </Button>
  );
  if (unavailableReason === undefined) return button;
  // A disabled button gets no pointer or focus events, so the tooltip hangs off
  // a wrapper. The hidden text gives assistive tech the same reason through
  // aria-describedby, which resolves a hidden node; a visible-to-AT text node
  // would be read twice in browse mode.
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex cursor-not-allowed">{button}</span>}
        />
        <TooltipContent>
          <p>{unavailableReason}</p>
        </TooltipContent>
      </Tooltip>
      <span id={reasonId} hidden>
        {unavailableReason}
      </span>
    </>
  );
}
