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
import { STATUS_OPTIONS } from "@/lib/jobs/constants";

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
  statusSummary?: Record<string, number>;
  dataUpdatedAt?: number;
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
}: JobsToolbarProps) {
  const lastUpdatedText = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search by name, ID, or service..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
              label: appSummary?.[s] != null
                ? `${formatServiceName(s)} (${appSummary[s]})`
                : formatServiceName(s),
            })),
          ]}
          value={serviceFilter}
          onValueChange={(value) =>
            value != null && onServiceFilterChange(value)
          }
        >
          <SelectTrigger className="w-68">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Services</SelectItem>
              {availableServices.map((app) => (
                <SelectItem key={app} value={app}>
                  {formatServiceName(app)}
                  {appSummary?.[app] != null && ` (${appSummary[app]})`}
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

      </div>

      {/* Status bar + refresh */}
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        {statusSummary && (
          <>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-500" />
              queued:{" "}
              <span className="text-foreground font-medium">
                {statusSummary.queued ?? 0}
              </span>
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 text-blue-500" />
              running:{" "}
              <span className="text-foreground font-medium">
                {(statusSummary.running ?? 0) +
                  (statusSummary["in-progress"] ?? 0)}
              </span>
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              completed:{" "}
              <span className="text-foreground font-medium">
                {statusSummary.completed ?? 0}
              </span>
            </span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              failed:{" "}
              <span className="text-foreground font-medium">
                {statusSummary.failed ?? 0}
              </span>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {lastUpdatedText && (
            <span className="text-muted-foreground text-xs">
              Last updated: {lastUpdatedText}
            </span>
          )}
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
      </div>
    </div>
  );
}
