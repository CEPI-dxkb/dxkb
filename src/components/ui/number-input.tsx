import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { forwardRef, useEffect, useEffectEvent, useState, useRef } from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<
  NumericFormatProps,
  "value" | "onValueChange"
> {
  stepper?: number;
  thousandSeparator?: string;
  placeholder?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  value?: number; // Controlled value
  suffix?: string;
  prefix?: string;
  onValueChange?: (value: number | undefined) => void;
  fixedDecimalScale?: boolean;
  decimalScale?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      stepper,
      thousandSeparator,
      placeholder,
      defaultValue,
      min = -Infinity,
      max = Infinity,
      onValueChange,
      fixedDecimalScale = false,
      decimalScale = 0,
      suffix,
      prefix,
      value: controlledValue,
      className,
      ...props
    },
    ref,
  ) => {
    const [value, setValue] = useState<number | undefined>(
      controlledValue ?? defaultValue,
    );
    const inputRef = useRef<HTMLInputElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const holdTimeRef = useRef(0);
    const lastChangeTimeRef = useRef(0);

    const setInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const handleIncrement = () => {
      setValue((prev) =>
        prev === undefined
          ? (stepper ?? 1)
          : Math.min(prev + (stepper ?? 1), max),
      );
    };

    const handleDecrement = () => {
      setValue((prev) =>
        prev === undefined
          ? -(stepper ?? 1)
          : Math.max(prev - (stepper ?? 1), min),
      );
    };

    const getIntervalDuration = (holdTime: number) => {
      const maxHoldTime = 2000;
      const minInterval = 50;
      const maxInterval = 500;

      if (holdTime >= maxHoldTime) return minInterval;

      const progress = holdTime / maxHoldTime;
      return maxInterval - progress * (maxInterval - minInterval);
    };

    const startContinuousChange = (direction: "up" | "down") => {
      if (intervalRef.current) return;

      const startTime = Date.now();
      holdTimeRef.current = 0;
      lastChangeTimeRef.current = startTime;

      // Initial change
      if (direction === "up") {
        handleIncrement();
      } else {
        handleDecrement();
      }

      const updateInterval = () => {
        const now = Date.now();
        holdTimeRef.current = now - startTime;

        const intervalDuration = getIntervalDuration(holdTimeRef.current);

        if (now - lastChangeTimeRef.current >= intervalDuration) {
          if (direction === "up") {
            handleIncrement();
          } else {
            handleDecrement();
          }
          lastChangeTimeRef.current = now;
        }

        intervalRef.current = setTimeout(updateInterval, 16); // ~60fps
      };

      updateInterval();
    };

    const stopContinuousChange = () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleArrowKey = useEffectEvent((e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) {
        if (e.key === "ArrowUp") {
          handleIncrement();
        } else if (e.key === "ArrowDown") {
          handleDecrement();
        }
      }
    });

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        handleArrowKey(e);
      };

      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, []);

    const [prevControlledValue, setPrevControlledValue] =
      useState(controlledValue);
    if (
      controlledValue !== undefined &&
      controlledValue !== prevControlledValue
    ) {
      setPrevControlledValue(controlledValue);
      setValue(controlledValue);
    }

    const handleChange = (values: {
      value: string;
      floatValue: number | undefined;
    }) => {
      const newValue =
        values.floatValue === undefined ? undefined : values.floatValue;
      setValue(newValue);
      if (onValueChange) {
        onValueChange(newValue);
      }
    };

    const handleBlur = () => {
      if (value !== undefined) {
        if (value < min) {
          setValue(min);
          if (inputRef.current) inputRef.current.value = String(min);
        } else if (value > max) {
          setValue(max);
          if (inputRef.current) inputRef.current.value = String(max);
        }
      }
    };

    return (
      <div className="flex items-center">
        <NumericFormat
          value={value}
          onValueChange={handleChange}
          thousandSeparator={thousandSeparator}
          decimalScale={decimalScale}
          fixedDecimalScale={fixedDecimalScale}
          allowNegative={min < 0}
          valueIsNumericString
          onBlur={handleBlur}
          max={max}
          min={min}
          suffix={suffix}
          prefix={prefix}
          customInput={Input}
          placeholder={placeholder}
          // Merged, not replaced: a caller's className used to overwrite these
          // (it arrived later through `...props`), dropping the joined right
          // edge and the hidden spin buttons.
          className={cn(
            "relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            className,
          )}
          getInputRef={setInputRef}
          {...props}
        />

        <div className="flex flex-col">
          <Button
            type="button"
            aria-label="Increase value"
            className="h-4 rounded-l-none rounded-br-none border-b-[0.5px] border-l-0 border-input px-2 focus-visible:relative"
            variant="outline"
            onMouseDown={() => {
              startContinuousChange("up");
            }}
            onMouseUp={stopContinuousChange}
            onMouseLeave={stopContinuousChange}
            disabled={value === max}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            type="button"
            aria-label="Decrease value"
            className="h-4 rounded-l-none rounded-tr-none border-t-[0.5px] border-l-0 border-input px-2 focus-visible:relative"
            variant="outline"
            onMouseDown={() => {
              startContinuousChange("down");
            }}
            onMouseUp={stopContinuousChange}
            onMouseLeave={stopContinuousChange}
            disabled={value === min}
          >
            <ChevronDown size={15} />
          </Button>
        </div>
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";
