"use client";

import { useState, type ReactNode } from "react";
import { Check, Download, GitFork, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { allLayouts } from "@/lib/interactions/renderer-capabilities";
import type {
  HubSelection,
  LayoutName,
  SubgraphSelection,
} from "@/lib/interactions/types";

const layoutLabels: Record<LayoutName, string> = {
  cola: "Cola",
  "cose-bilkent": "Cose-Bilkent",
  dagre: "Dagre",
  grid: "Grid",
  concentric: "Concentric",
  random: "Random",
  forceatlas2: "Force Atlas 2",
  circular: "Circular",
};

const subgraphOptions: [SubgraphSelection, string][] = [
  [5, "5 or More Nodes"],
  [10, "10 or More Nodes"],
  [20, "20 or More Nodes"],
  ["max", "Largest Subgraph"],
];

const hubOptions: [HubSelection, string][] = [
  [3, "3 or More Neighbors"],
  [4, "4 or More Neighbors"],
  [5, "5 or More Neighbors"],
  [10, "10 or More Neighbors"],
  ["max", "Most Connected Hub"],
];

interface GraphActionBarProps {
  layout: LayoutName;
  activeSubgraph: SubgraphSelection | null;
  activeHub: HubSelection | null;
  onLayoutChange: (layout: LayoutName) => void;
  onExport: () => void;
  onSelectSubgraphs: (threshold: SubgraphSelection) => void;
  onSelectHubs: (threshold: HubSelection) => void;
  exportReady: boolean;
}

function SelectionMenu<T extends SubgraphSelection | HubSelection>({
  label,
  icon,
  options,
  value,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  options: [T, string][];
  value: T | null;
  onSelect: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(([option]) => option === value)?.[1];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={value === null ? "outline" : "secondary"}
            size="sm"
          />
        }
      >
        {icon}
        {selectedLabel ?? label}
      </PopoverTrigger>
      <PopoverContent align="start" size="menu" className="w-52">
        {options.map(([option, optionLabel]) => {
          const isSelected = option === value;
          return (
            <Button
              key={String(option)}
              variant={isSelected ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start"
              aria-pressed={isSelected}
              onClick={() => {
                onSelect(option);
                setOpen(false);
              }}
            >
              <Check className={isSelected ? "visible" : "invisible"} />
              {optionLabel}
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** Graph action band spanning the canvas column. */
export function GraphActionBar({
  layout,
  activeSubgraph,
  activeHub,
  onLayoutChange,
  onExport,
  onSelectSubgraphs,
  onSelectHubs,
  exportReady,
}: GraphActionBarProps) {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-2 py-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={
                  exportReady ? undefined : "inline-flex cursor-not-allowed"
                }
                tabIndex={exportReady ? undefined : 0}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExport}
                  disabled={!exportReady}
                >
                  <Download />
                  Export
                </Button>
              </span>
            }
          />
          {!exportReady && (
            <TooltipContent>
              <p>Loading graph...</p>
            </TooltipContent>
          )}
        </Tooltip>

        <SelectionMenu
          label="Sub-Graph"
          icon={<GitFork />}
          options={subgraphOptions}
          value={activeSubgraph}
          onSelect={onSelectSubgraphs}
        />
        <SelectionMenu
          label="Hub Protein"
          icon={<Network />}
          options={hubOptions}
          value={activeHub}
          onSelect={onSelectHubs}
        />

        <Select
          items={layoutLabels}
          value={layout}
          onValueChange={(value) => {
            onLayoutChange(value as LayoutName);
          }}
        >
          <SelectTrigger aria-label="Layout" className="w-40">
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {allLayouts.map((name) => (
                <SelectItem key={name} value={name}>
                  {layoutLabels[name]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </TooltipProvider>
  );
}
