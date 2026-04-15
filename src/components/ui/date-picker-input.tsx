"use client";

import * as React from "react";
import { format as formatDateFns, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const formatMap = {
  "MM/DD/YYYY": {
    mask: [2, 2, 4] as number[],
    separator: "/",
    dateFns: "MM/dd/yyyy",
    placeholder: "MM/DD/YYYY",
    regex: /^\d{2}\/\d{2}\/\d{4}$/,
  },
  "DD/MM/YYYY": {
    mask: [2, 2, 4] as number[],
    separator: "/",
    dateFns: "dd/MM/yyyy",
    placeholder: "DD/MM/YYYY",
    regex: /^\d{2}\/\d{2}\/\d{4}$/,
  },
  "YYYY/MM/DD": {
    mask: [4, 2, 2] as number[],
    separator: "/",
    dateFns: "yyyy/MM/dd",
    placeholder: "YYYY/MM/DD",
    regex: /^\d{4}\/\d{2}\/\d{2}$/,
  },
} as const;

interface DatePickerInputProps {
  className?: string;
  format?: keyof typeof formatMap;
  value?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
}

export function DatePickerInput({
  className,
  format = "MM/DD/YYYY",
  value,
  onDateChange,
  placeholder,
}: DatePickerInputProps) {
  const fmt = formatMap[format] || formatMap["MM/DD/YYYY"];
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [inputValue, setInputValue] = React.useState<string>(
    value ? formatDateFns(value, fmt.dateFns) : "",
  );
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(
    value ?? new Date(),
  );
  const [error, setError] = React.useState<string>("");

  // Sync from external value prop or format change
  React.useEffect(() => {
    if (value === undefined) {
      setDate(undefined);
      setInputValue("");
    } else if (value) {
      setDate(value);
      setInputValue(formatDateFns(value, fmt.dateFns));
      setCalendarMonth(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fmt.dateFns]);

  // Format input as selected format
  function formatInputValue(value: string) {
    const numbers = value.replace(/\D/g, "");
    let result = "";
    let idx = 0;
    for (let i = 0; i < fmt.mask.length; i++) {
      const len = fmt.mask[i];
      if (numbers.length > idx) {
        result += numbers.slice(idx, idx + len);
        if (i < fmt.mask.length - 1 && numbers.length > idx + len - 1) {
          result += fmt.separator;
        }
        idx += len;
      }
    }
    return result;
  }

  // Parse input as selected format
  function parseInputDate(value: string): Date | undefined {
    if (fmt.regex.test(value)) {
      const parsed = parse(value, fmt.dateFns, new Date());
      if (isValid(parsed)) return parsed;
    }
    return undefined;
  }

  // Handle input change
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    const formattedValue = formatInputValue(value);
    setInputValue(formattedValue);
    const parsed = parseInputDate(formattedValue);
    if (
      formattedValue.length ===
      fmt.mask.reduce((a, b) => a + b) + (fmt.mask.length - 1)
    ) {
      if (parsed) {
        setDate(parsed);
        setCalendarMonth(parsed);
        setError("");
        onDateChange?.(parsed);
      } else {
        setError(
          `Invalid date. Please enter a valid date in ${fmt.placeholder} format.`,
        );
      }
    } else {
      setError("");
      if (formattedValue === "") {
        setDate(undefined);
        onDateChange?.(undefined);
      }
    }
  }

  // Handle calendar date select
  function handleDateSelect(selectedDate: Date | undefined) {
    setDate(selectedDate);
    if (selectedDate) {
      setInputValue(formatDateFns(selectedDate, fmt.dateFns));
      setCalendarMonth(selectedDate);
      setError("");
    } else {
      setInputValue("");
    }
    onDateChange?.(selectedDate);
  }

  // When inputValue changes (from outside, e.g. reset), update calendarMonth
  React.useEffect(() => {
    const parsed = parseInputDate(inputValue);
    if (parsed) setCalendarMonth(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // When popover opens, sync calendarMonth to input or today
  const popoverRef = React.useRef<HTMLButtonElement>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  function handlePopoverOpenChange(open: boolean) {
    setPopoverOpen(open);
    if (open) {
      const parsed = parseInputDate(inputValue);
      setCalendarMonth(parsed || new Date());
    }
  }

  return (
    <div className="relative flex w-full flex-col items-start gap-1">
      <div className="relative flex w-full items-center">
        <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
          <PopoverTrigger
            render={
              <Button
                ref={popoverRef}
                variant="ghost"
                size="icon"
                className="hover:bg-secondary/10 absolute left-0.5 h-[90%] border border-border hover:border-muted-foreground focus-visible:border focus-visible:border-muted-foreground"
                tabIndex={-1}
                aria-label="Open calendar"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
            />
          </PopoverContent>
        </Popover>

        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder ?? fmt.placeholder}
          maxLength={fmt.mask.reduce((a, b) => a + b) + (fmt.mask.length - 1)}
          className={cn(
            "w-full pl-10 bg-muted",
            !date && "text-muted-foreground",
            error && "border-red-500 focus-visible:ring-red-500",
            className,
          )}
          inputMode="numeric"
          pattern="[0-9/]*"
          aria-label={`Date input in ${fmt.placeholder} format`}
          aria-invalid={!!error}
          aria-describedby={error ? "date-picker-error" : undefined}
        />
      </div>
      {error && (
        <span
          id="date-picker-error"
          className="mt-1 text-xs text-red-500"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
