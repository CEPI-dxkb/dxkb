"use client";

import { useMemo, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Ban,
} from "lucide-react";
import type { JobListItem, JobStatus } from "@/types/workspace";
import { formatDate } from "@/lib/services/workspace/helpers";
import type { DataTableSort } from "@/components/shared/data-table";

const statusConfig: Record<
  string,
  { icon: React.ElementType; className: string; label: string }
> = {
  completed: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    label: "Completed",
  },
  failed: { icon: XCircle, className: "text-red-500", label: "Failed" },
  error: { icon: AlertCircle, className: "text-red-600", label: "Error" },
  running: {
    icon: Loader2,
    className: "text-blue-500 animate-spin",
    label: "Running",
  },
  "in-progress": {
    icon: Loader2,
    className: "text-blue-500 animate-spin",
    label: "Running",
  },
  queued: { icon: Clock, className: "text-gray-500", label: "Queued" },
  pending: { icon: Clock, className: "text-gray-400", label: "Pending" },
  cancelled: { icon: Ban, className: "text-orange-500", label: "Cancelled" },
};

function StatusCell({ status }: { status: JobStatus }) {
  const config = statusConfig[status] ?? statusConfig.pending;
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${config.className}`} />
      <span className="text-muted-foreground truncate text-xs">
        {config.label}
      </span>
    </div>
  );
}

/** Format camelCase or PascalCase app names into readable labels. */
export function formatServiceName(app: string): string {
  if (!app) return "";
  return app
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function getOutputName(job: JobListItem): string {
  const outputFile =
    job.output_file ?? String(job.parameters?.output_file ?? "");
  if (outputFile) return outputFile;
  return "\u2014";
}

export function useJobsColumns(
  sort: DataTableSort,
  onSortChange: (sort: DataTableSort) => void,
) {
  const handleSort = useCallback(
    (field: string) => {
      if (sort.field === field) {
        onSortChange({
          field,
          direction: sort.direction === "asc" ? "desc" : "asc",
        });
      } else {
        onSortChange({ field, direction: "asc" });
      }
    },
    [sort.field, sort.direction, onSortChange],
  );

  const columns = useMemo<ColumnDef<JobListItem>[]>(
    () => [
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusCell status={row.original.status} />,
        meta: { className: "", sortField: "status" },
        size: 100,
        enableResizing: true,
      },
      {
        id: "id",
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => (
          <span
            className="text-muted-foreground block truncate font-mono text-xs"
            title={String(getValue())}
          >
            {String(getValue())}
          </span>
        ),
        meta: { className: "" },
        size: 70,
        enableResizing: true,
      },
      {
        id: "app",
        accessorKey: "app",
        header: "Service",
        cell: ({ getValue }) => (
          <span
            className="block truncate font-medium"
            title={String(getValue())}
          >
            {formatServiceName(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: "", sortField: "app" },
        size: 160,
        enableResizing: true,
      },
      {
        id: "output_name",
        header: "Output Name",
        cell: ({ row }) => (
          <span
            className="text-muted-foreground block truncate"
            title={getOutputName(row.original)}
          >
            {getOutputName(row.original)}
          </span>
        ),
        meta: { className: "" },
        size: 180,
        enableResizing: true,
      },
      {
        id: "submit_time",
        accessorKey: "submit_time",
        header: "Submit",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {formatDate(String(getValue() ?? ""))}
          </span>
        ),
        meta: { className: "", sortField: "submit_time" },
        size: 120,
        enableResizing: true,
      },
      {
        id: "start_time",
        accessorKey: "start_time",
        header: "Start",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {getValue() ? formatDate(String(getValue())) : "\u2014"}
          </span>
        ),
        meta: { className: "", sortField: "start_time" },
        size: 120,
        enableResizing: true,
      },
      {
        id: "completed_time",
        accessorKey: "completed_time",
        header: "Completed",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block truncate">
            {getValue() ? formatDate(String(getValue())) : "\u2014"}
          </span>
        ),
        meta: {
          className: "",
          sortField: "completed_time",
        },
        size: 120,
        enableResizing: true,
      },
    ],
    [],
  );

  return { columns, handleSort };
}
