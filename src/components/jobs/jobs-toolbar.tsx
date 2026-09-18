"use client";



import {
  Search,
  RefreshCw,
  Archive,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatServiceName } from "@/lib/jobs/formatting";
import { statusOptions } from "@/lib/jobs/constants";
import { JobsDateFilter } from "./jobs-date-filter";

function formatTimestamp(ts: number | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString();
}

interface JobsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (value: string) => void;
  availableServices: string[];
  appSummary?: Record<string, number>;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  statusSummary?: Record<string, number | undefined>;
  dataUpdatedAt?: number;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFilterChange: (from: Date | undefined, to: Date | undefined) => void;
}

export function JobsToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  serviceFilter,
  onServiceFilterChange,
  availableServices,
  appSummary,
  includeArchived,
  onIncludeArchivedChange,
  onRefresh,
  isRefreshing,
  statusSummary,
  dataUpdatedAt,
  dateFrom,
  dateTo,
  onDateFilterChange,
}: JobsToolbarProps) {

  const lastUpdatedText = formatTimestamp(dataUpdatedAt);
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or service..."
          value={searchQuery}
          onChange={(e) => { onSearchChange(e.target.value); }}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Service filter */}
        <Select
          items={[
            { value: "all", label: "All Services" },
            ...availableServices.map((s) => ({
              value: s,
              label: appSummary?.[s] != null
                ? `${formatServiceName(s)} (${String(appSummary[s])})`
                : formatServiceName(s),
            })),
          ]}
          value={serviceFilter}
          onValueChange={(value) => {
            if (value != null) onServiceFilterChange(value);
          }}
        >
          <SelectTrigger aria-label="Filter by service" className="w-68">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Services</SelectItem>
              {availableServices.map((app) => (
                <SelectItem key={app} value={app}>
                  {formatServiceName(app)}
                  {appSummary?.[app] != null && ` (${String(appSummary[app])})`}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          items={statusOptions}
          value={statusFilter}
          onValueChange={(value) => {
            if (value != null) onStatusFilterChange(value);
          }}
        >
          <SelectTrigger aria-label="Filter by status" className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Date filter */}
        <JobsDateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFilterChange={onDateFilterChange}
        />

        {/* Archived toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-archived"
            checked={includeArchived}
            onCheckedChange={(checked) =>
              { onIncludeArchivedChange(checked); }
            }
          />
          <Label
            htmlFor="include-archived"
            className="flex cursor-pointer items-center gap-1 text-sm font-normal"
          >
            <Archive className="size-3.5" />
            Archived
          </Label>
        </div>

      </div>

      {/* Status bar + refresh */}
      <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {statusSummary && (
          <>
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-gray-500" />
              queued:{" "}
              <span className="font-medium text-foreground">
                {statusSummary.queued ?? 0}
              </span>
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Loader2 className="size-3 text-blue-500" />
              running:{" "}
              <span className="font-medium text-foreground">
                {(statusSummary.running ?? 0) +
                  (statusSummary["in-progress"] ?? 0)}
              </span>
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-500" />
              completed:{" "}
              <span className="font-medium text-foreground">
                {statusSummary.completed ?? 0}
              </span>
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <XCircle className="size-3 text-red-500" />
              failed:{" "}
              <span className="font-medium text-foreground">
                {statusSummary.failed ?? 0}
              </span>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {lastUpdatedText && (
            <span data-testid="jobs-last-updated" className="inline-block w-36 text-right text-xs text-muted-foreground">
              Last updated: {lastUpdatedText}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label="Refresh jobs"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
