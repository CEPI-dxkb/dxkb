import type { DataTableSort } from "@/components/shared/file-table";
import { defaultPageSize, pageSizeOptions, statusOptions } from "./constants";

/**
 * Columns the jobs endpoint can sort by (jobs-table-columns.tsx `meta.sortField`).
 * jobs-url-state.test.ts fails when a sortable column is missing from this list.
 */
const jobsSortFields = [
  "status",
  "app",
  "submit_time",
  "start_time",
  "completed_time",
] as const;

export interface JobsUrlState {
  /** One of statusOptions' values; "all" means unfiltered. */
  status: string;
  /** An app id, or "all". */
  service: string;
  /** Client-side text filter over the current page. */
  search: string;
  includeArchived: boolean;
  /** Local calendar dates, YYYY-MM-DD, inclusive. */
  dateFrom?: string;
  dateTo?: string;
  sort: DataTableSort;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export const defaultJobsUrlState: JobsUrlState = {
  status: "all",
  service: "all",
  search: "",
  includeArchived: false,
  dateFrom: undefined,
  dateTo: undefined,
  sort: { field: "submit_time", direction: "desc" },
  page: 1,
  pageSize: defaultPageSize,
};

const statusValues = new Set(statusOptions.map((option) => option.value));
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalDateParam(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromLocalDateParam(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDate(value: string | null): string | undefined {
  if (!value || !localDatePattern.test(value)) return undefined;
  // Reject dates that roll over (2026-02-30 → March 2).
  return toLocalDateParam(fromLocalDateParam(value)) === value ? value : undefined;
}

function isJobsSortField(value: string): boolean {
  return (jobsSortFields as readonly string[]).includes(value);
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

export function parseJobsUrlState(params: URLSearchParams): JobsUrlState {
  const status = params.get("status");
  const [sortField = "", sortDirection] = (params.get("sort") ?? "").split(":");
  const pageSize = positiveInteger(params.get("pageSize"));
  return {
    status: status && statusValues.has(status) ? status : "all",
    service: params.get("service") || "all",
    search: params.get("q") ?? "",
    includeArchived: params.get("archived") === "true",
    dateFrom: localDate(params.get("from")),
    dateTo: localDate(params.get("to")),
    sort:
      isJobsSortField(sortField) &&
      (sortDirection === "asc" || sortDirection === "desc")
        ? { field: sortField, direction: sortDirection }
        : defaultJobsUrlState.sort,
    page: positiveInteger(params.get("page")) ?? 1,
    pageSize:
      pageSize !== undefined &&
      (pageSizeOptions as readonly number[]).includes(pageSize)
        ? pageSize
        : defaultPageSize,
  };
}

/**
 * Every param name serializeJobsUrlState can write. A URL writer drops these and
 * keeps the rest, such as `utm_source`, which belong to someone else.
 */
export const jobsUrlParamNames = [
  "status",
  "service",
  "q",
  "archived",
  "from",
  "to",
  "sort",
  "page",
  "pageSize",
] as const;

export function serializeJobsUrlState(state: JobsUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.status !== "all") params.set("status", state.status);
  if (state.service !== "all") params.set("service", state.service);
  if (state.search) params.set("q", state.search);
  if (state.includeArchived) params.set("archived", "true");
  if (state.dateFrom) params.set("from", state.dateFrom);
  if (state.dateTo) params.set("to", state.dateTo);
  const { sort } = defaultJobsUrlState;
  if (state.sort.field !== sort.field || state.sort.direction !== sort.direction) {
    params.set("sort", `${state.sort.field}:${state.sort.direction}`);
  }
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize !== defaultPageSize) {
    params.set("pageSize", String(state.pageSize));
  }
  return params;
}
