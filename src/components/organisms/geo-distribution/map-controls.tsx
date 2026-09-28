"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { GeoMapState, GeoMapView } from "./types";

interface StateOption {
  fips: string;
  name: string;
}

interface MapControlsProps {
  mapState: GeoMapState;
  stateOptions: StateOption[];
  onViewChange: (view: GeoMapView) => void;
  onSelectState: (fips: string, name: string) => void;
}

export function MapControls({
  mapState,
  stateOptions,
  onViewChange,
  onSelectState,
}: MapControlsProps) {
  const isStateView = mapState.view === "state";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
        <PillButton active={mapState.view === "world"} onClick={() => { onViewChange("world"); }}>
          World
        </PillButton>
        <PillButton active={mapState.view === "us"} onClick={() => { onViewChange("us"); }}>
          United States
        </PillButton>
        <PillButton active={isStateView} onClick={() => { onViewChange("state"); }}>
          State
        </PillButton>
      </div>

      <div className={cn(
        "overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out",
        isStateView && stateOptions.length > 0 ? "max-w-55 opacity-100" : "pointer-events-none max-w-0 opacity-0",
      )}>
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
  );
}

interface PillButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function PillButton({ active, onClick, children }: PillButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="xs"
      aria-pressed={active}
      onClick={onClick}
      className={cn(active && "shadow-sm")}
    >
      {children}
    </Button>
  );
}
