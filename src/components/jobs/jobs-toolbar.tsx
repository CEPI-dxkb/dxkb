"use client";

import { Search, RefreshCw, Archive, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ColumnOption {
  id: string;
  label: string;
}

interface JobsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (value: string) => void;
  availableServices: string[];
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  statusSummary?: Record<string, number>;
  columnOptions?: ColumnOption[];
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
}

/** Format camelCase or PascalCase app names into readable labels. */
function formatServiceLabel(app: string): string {
  if (!app) return "";
  return app
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export function JobsToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  serviceFilter,
  onServiceFilterChange,
  availableServices,
  includeArchived,
  onIncludeArchivedChange,
  onRefresh,
  isRefreshing,
  statusSummary,
  columnOptions,
  columnVisibility,
  onColumnVisibilityChange,
}: JobsToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, ID, or service..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status filter */}
        <Select
          items={STATUS_OPTIONS}
          value={statusFilter}
          onValueChange={(value) =>
            value != null && onStatusFilterChange(value)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Service filter */}
        <Select
          items={[
            { value: "all", label: "All Services" },
            ...availableServices.map((s) => ({
              value: s,
              label: formatServiceLabel(s),
            })),
          ]}
          value={serviceFilter}
          onValueChange={(value) =>
            value != null && onServiceFilterChange(value)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Services</SelectItem>
              {availableServices.map((app) => (
                <SelectItem key={app} value={app}>
                  {formatServiceLabel(app)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Archived toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-archived"
            checked={includeArchived}
            onCheckedChange={(checked) =>
              onIncludeArchivedChange(checked === true)
            }
          />
          <Label
            htmlFor="include-archived"
            className="text-muted-foreground flex cursor-pointer items-center gap-1 text-sm"
          >
            <Archive className="h-3.5 w-3.5" />
            Archived
          </Label>
        </div>

        {/* Column selector */}
        {columnOptions && columnVisibility && onColumnVisibilityChange && (
          <DropdownMenu>
            <DropdownMenuTrigger className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium whitespace-nowrap">
              <Columns3 className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Columns</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {columnOptions.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={columnVisibility[col.id] !== false}
                  onCheckedChange={(checked) =>
                    onColumnVisibilityChange(col.id, checked)
                  }
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Refresh */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Compact status bar */}
      {statusSummary && (
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <span>
            queued:{" "}
            <span className="text-foreground font-medium">
              {statusSummary.queued ?? 0}
            </span>
          </span>
          <span>&middot;</span>
          <span>
            running:{" "}
            <span className="text-foreground font-medium">
              {(statusSummary.running ?? 0) +
                (statusSummary["in-progress"] ?? 0)}
            </span>
          </span>
          <span>&middot;</span>
          <span>
            completed:{" "}
            <span className="text-foreground font-medium">
              {statusSummary.completed ?? 0}
            </span>
          </span>
          <span>&middot;</span>
          <span>
            failed:{" "}
            <span className="text-foreground font-medium">
              {statusSummary.failed ?? 0}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
