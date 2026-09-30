"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
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
import { toLocalDateParam } from "@/lib/jobs/jobs-url-state";

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

// Before/After step by calendar day (addDays), not by 24 hours: a day is 23 or
// 25 hours long when the clocks change, and the result goes into the URL.
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
      return { from: undefined, to: addDays(date, -1) };
    case "is_after":
      return { from: addDays(date, 1), to: undefined };
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
  const label =
    conditionOptions.find((o) => o.value === condition)?.label ?? "";
  const d = format(date, "MMM d, yyyy");
  if (condition === "is_in_between" && endDate) {
    return `${label} ${d} → ${format(endDate, "MMM d, yyyy")}`;
  }
  if (condition === "is_in_between" && !endDate) {
    return `Starting ${d} →`;
  }
  return `${label} ${d}`;
}

/** What the popover shows: a condition and the dates picked for it. */
interface DateChoice {
  condition: DateCondition;
  singleDate: Date | undefined;
  rangeFrom: Date | undefined;
  rangeTo: Date | undefined;
}

/** Local calendar day of a date, the granularity the filter is applied at. */
function dayOf(date: Date | undefined): string | undefined {
  return date ? toLocalDateParam(date) : undefined;
}

/**
 * The choice that best describes an applied `from`/`to`, for when the filter
 * did not come from this component's own picks (a URL load, Back/Forward). The
 * dates alone do not say which condition made them, so this is the plainest
 * reading. With no dates, the condition already open stays.
 */
function choiceFromDates(
  from: Date | undefined,
  to: Date | undefined,
  currentCondition: DateCondition,
): DateChoice {
  const none = {
    singleDate: undefined,
    rangeFrom: undefined,
    rangeTo: undefined,
  };
  if (from && to) {
    if (dayOf(from) === dayOf(to)) {
      return { ...none, condition: "is", singleDate: from };
    }
    return { ...none, condition: "is_in_between", rangeFrom: from, rangeTo: to };
  }
  if (from) return { ...none, condition: "is_on_or_after", singleDate: from };
  if (to) return { ...none, condition: "is_on_or_before", singleDate: to };
  return { ...none, condition: currentCondition };
}

/** Whether a choice, applied, gives exactly these dates (by calendar day). */
function choiceProduces(
  choice: DateChoice,
  from: Date | undefined,
  to: Date | undefined,
): boolean {
  const isRange = choice.condition === "is_in_between";
  const own = conditionToApiDates(
    choice.condition,
    isRange ? choice.rangeFrom : choice.singleDate,
    isRange ? choice.rangeTo : undefined,
  );
  return dayOf(own.from) === dayOf(from) && dayOf(own.to) === dayOf(to);
}

export function JobsDateFilter({
  dateFrom,
  dateTo,
  onFilterChange,
}: JobsDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(() =>
    choiceFromDates(dateFrom, dateTo, "is_in_between"),
  );
  const { condition, singleDate, rangeFrom, rangeTo } = choice;

  // The dates are applied elsewhere (the URL), so they can change without this
  // component: a refresh, a shared link, Back/Forward. When they no longer
  // match what the user picked here, show what they say. When they do (the
  // user's own pick coming back through the parent), keep the user's condition:
  // "Before Sep 10" is applied as "to Sep 9" and must not turn into "On or
  // before Sep 9".
  const appliedDays = `${dayOf(dateFrom) ?? ""}|${dayOf(dateTo) ?? ""}`;
  const [previousDays, setPreviousDays] = useState(appliedDays);
  if (previousDays !== appliedDays) {
    setPreviousDays(appliedDays);
    if (!choiceProduces(choice, dateFrom, dateTo)) {
      setChoice(choiceFromDates(dateFrom, dateTo, condition));
    }
  }

  const isRange = condition === "is_in_between";
  const hasActiveFilter = dateFrom !== undefined || dateTo !== undefined;

  const activeLabel = hasActiveFilter
    ? formatTriggerLabel(condition, isRange ? rangeFrom : singleDate, rangeTo)
    : null;

  const applyFilter = (
    cond: DateCondition,
    date: Date | undefined,
    end: Date | undefined,
  ) => {
    const { from, to } = conditionToApiDates(cond, date, end);
    onFilterChange(from, to);
  };

  const handleConditionChange = (value: string) => {
    setChoice(choiceFromDates(undefined, undefined, value as DateCondition));
    onFilterChange(undefined, undefined);
  };

  const handleSingleDateSelect = (date: Date | undefined) => {
    setChoice({ ...choice, singleDate: date });
    if (date) applyFilter(condition, date, undefined);
  };

  const handleRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    const from = range?.from;
    const to = range?.to;
    setChoice({ ...choice, rangeFrom: from, rangeTo: to });
    applyFilter("is_in_between", from, to);
  };

  const resetFilter = (closePopover: boolean) => {
    setChoice(choiceFromDates(undefined, undefined, condition));
    onFilterChange(undefined, undefined);
    if (closePopover) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <PopoverTrigger
          render={
            <Button variant={hasActiveFilter ? "field-active" : "field"}>
              <CalendarIcon className="size-3.5" />
              <span className="max-w-60 truncate">
                {activeLabel ?? "All dates"}
              </span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          }
        />
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              resetFilter(true);
            }}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <PopoverContent size="flush" className="w-auto" align="start">
        <div className="space-y-3 p-4">
          {/* Header: label + condition dropdown + delete */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Submitted</span>
            <Select
              items={conditionOptions}
              value={condition}
              onValueChange={(value) => {
                if (value != null) handleConditionChange(value);
              }}
            >
              <SelectTrigger density="compact-tight" className="h-8 w-auto">
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
              className="ml-auto text-xs text-destructive hover:underline"
              onClick={() => {
                resetFilter(false);
              }}
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
