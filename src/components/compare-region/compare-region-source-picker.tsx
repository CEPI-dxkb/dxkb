"use client";

import {
  ChevronDown,
  FolderTree,
  Globe2,
  ListTree,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import {
  compareRegionFilterLabels,
  compareRegionFilters,
  compareRegionGroupLabels,
  isCompareRegionGroupFilter,
  type CompareRegionFilter,
  type CompareRegionGroupFilter,
} from "@/lib/compare-region/contract";

const publicSources = compareRegionFilters.filter(
  (filter) => !isCompareRegionGroupFilter(filter),
);
const groupSources = compareRegionFilters.filter(isCompareRegionGroupFilter);
const sourceIcons = {
  reference: Sparkles,
  all: Globe2,
  genomeGroup: FolderTree,
  featureGroup: ListTree,
} as const;

interface SourceMenuProps {
  filter: CompareRegionFilter;
  groupName: string;
  busy: boolean;
  signedIn: boolean;
  onChange: (filter: CompareRegionFilter) => void;
}

export function SourceMenu({
  filter,
  groupName,
  busy,
  signedIn,
  onChange,
}: SourceMenuProps) {
  const Icon = sourceIcons[filter];
  const text =
    isCompareRegionGroupFilter(filter) && groupName
      ? `${compareRegionGroupLabels[filter]}: ${groupName}`
      : compareRegionFilterLabels[filter];
  const pick = (value: unknown) => {
    const next = compareRegionFilters.find((candidate) => candidate === value);
    if (next) onChange(next);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={`Genomes: ${text}`}
          />
        }
      >
        <Icon className="text-muted-foreground" />
        <span className="max-w-56 truncate">{text}</span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={filter} onValueChange={pick}>
          <DropdownMenuLabel>Public</DropdownMenuLabel>
          {publicSources.map((value) => {
            const ItemIcon = sourceIcons[value];
            return (
              <DropdownMenuRadioItem key={value} value={value} closeOnClick>
                <ItemIcon className="text-muted-foreground" />
                {compareRegionFilterLabels[value]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={filter} onValueChange={pick}>
          <DropdownMenuLabel>Your workspace</DropdownMenuLabel>
          {groupSources.map((value) => {
            const ItemIcon = sourceIcons[value];
            return (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                disabled={!signedIn}
                closeOnClick
              >
                <ItemIcon className="text-muted-foreground" />
                {compareRegionFilterLabels[value]}
              </DropdownMenuRadioItem>
            );
          })}
          {!signedIn && (
            <p className="flex items-center gap-1.5 px-1.5 pt-1 pb-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5 shrink-0" />
              Sign in to use your workspace groups
            </p>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface GroupPickerProps {
  id: string;
  source: CompareRegionGroupFilter;
  value: string;
  disabled: boolean;
  onPick: (path: string) => void;
}

export function GroupPicker({
  id,
  source,
  value,
  disabled,
  onPick,
}: GroupPickerProps) {
  return (
    <div className="w-72">
      <WorkspaceObjectSelector
        id={id}
        preset={source}
        value={value}
        disabled={disabled}
        placeholder={`Choose a ${compareRegionGroupLabels[source].toLowerCase()}…`}
        onObjectSelect={(object) => {
          onPick(object.path);
        }}
      />
    </div>
  );
}
