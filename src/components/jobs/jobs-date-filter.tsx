"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

type DateCondition =
  | "is"
  | "is_before"
  | "is_after"
  | "is_on_or_before"
  | "is_on_or_after"
  | "is_in_between";

const conditionOptions: { value: DateCondition; label: string }[] = [
  { value: "is", label: "On" },
  { value: "is_before", label: "Before" },
  { value: "is_after", label: "After" },
  { value: "is_on_or_before", label: "On or before" },
  { value: "is_on_or_after", label: "On or after" },
  { value: "is_in_between", label: "Between" },
];

interface JobsDateFilterProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onFilterChange: (from: Date | undefined, to: Date | undefined) => void;
}

const msPerDay = 24 * 60 * 60 * 1000;

function conditionToApiDates(
  condition: DateCondition,
  date: Date | undefined,
  endDate: Date | undefined,
): { from: Date | undefined; to: Date | undefined } {
  if (!date) return { from: undefined, to: undefined };
  switch (condition) {
    case "is":
      return { from: date, to: date };
    case "is_before":
      return { from: undefined, to: new Date(date.getTime() - msPerDay) };
    case "is_after":
      return { from: new Date(date.getTime() + msPerDay), to: undefined };
    case "is_on_or_before":
      return { from: undefined, to: date };
    case "is_on_or_after":
      return { from: date, to: undefined };
    case "is_in_between":
      return { from: date, to: endDate };
    default:
      return { from: undefined, to: undefined };
  }
}

function formatTriggerLabel(
  condition: DateCondition,
  date: Date | undefined,
  endDate: Date | undefined,
): string | null {
  if (!date) return null;
  const label = conditionOptions.find((o) => o.value === condition)?.label ?? "";
  const d = format(date, "MMM d, yyyy");
  if (condition === "is_in_between" && endDate) {
    return `${label} ${d} → ${format(endDate, "MMM d, yyyy")}`;
  }
  if (condition === "is_in_between" && !endDate) {
    return `Starting ${d} →`;
  }
  return `${label} ${d}`;
}

export function JobsDateFilter({
  dateFrom,
  dateTo,
  onFilterChange,
}: JobsDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<DateCondition>("is_in_between");
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);

  const isRange = condition === "is_in_between";
  const hasActiveFilter = dateFrom !== undefined || dateTo !== undefined;

  const activeLabel = hasActiveFilter
    ? formatTriggerLabel(condition, isRange ? rangeFrom : singleDate, rangeTo)
    : null;

  const applyFilter = useCallback(
    (cond: DateCondition, date: Date | undefined, end: Date | undefined) => {
      const { from, to } = conditionToApiDates(cond, date, end);
      onFilterChange(from, to);
    },
    [onFilterChange],
  );

  const handleConditionChange = useCallback(
    (value: string) => {
      const newCondition = value as DateCondition;
      setCondition(newCondition);
      // Reset dates when switching conditions
      setSingleDate(undefined);
      setRangeFrom(undefined);
      setRangeTo(undefined);
      onFilterChange(undefined, undefined);
    },
    [onFilterChange],
  );

  const handleSingleDateSelect = useCallback(
    (date: Date | undefined) => {
      setSingleDate(date);
      if (date) {
        applyFilter(condition, date, undefined);
      }
    },
    [condition, applyFilter],
  );

  const handleRangeSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      const from = range?.from;
      const to = range?.to;
      setRangeFrom(from);
      setRangeTo(to);
      applyFilter("is_in_between", from, to);
    },
    [applyFilter],
  );

  const resetFilter = useCallback(
    (closePopover: boolean) => {
      setSingleDate(undefined);
      setRangeFrom(undefined);
      setRangeTo(undefined);
      onFilterChange(undefined, undefined);
      if (closePopover) setOpen(false);
    },
    [onFilterChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={
                hasActiveFilter
                  ? "border-primary bg-primary/5 text-primary h-8 gap-1.5 rounded-lg text-sm font-normal"
                  : "border-input h-8 gap-1.5 rounded-lg text-sm font-normal"
              }
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="max-w-60 truncate">
                {activeLabel ?? "All dates"}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          }
        />
        {hasActiveFilter && (
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              resetFilter(true);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="space-y-3 p-4">
          {/* Header: label + condition dropdown + delete */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Submitted</span>
            <Select
              items={conditionOptions}
              value={condition}
              onValueChange={(value) =>
                value != null && handleConditionChange(value)
              }
            >
              <SelectTrigger className="h-8 w-auto gap-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {conditionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <button
              type="button"
              className="text-destructive ml-auto text-xs hover:underline"
              onClick={() => resetFilter(false)}
            >
              Clear
            </button>
          </div>

          {/* Calendar */}
          {isRange ? (
            <Calendar
              mode="range"
              selected={
                rangeFrom ? { from: rangeFrom, to: rangeTo } : undefined
              }
              onSelect={handleRangeSelect}
              numberOfMonths={2}
            />
          ) : (
            <Calendar
              mode="single"
              selected={singleDate}
              onSelect={handleSingleDateSelect}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
