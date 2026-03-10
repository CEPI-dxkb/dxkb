import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { forwardRef, useCallback, useEffect, useState, useRef } from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface NumberInputProps
  extends Omit<NumericFormatProps, "value" | "onValueChange"> {
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
      ...props
    },
    ref,
  ) => {
    const [value, setValue] = useState<number | undefined>(
      controlledValue ?? defaultValue,
    );
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const holdTimeRef = useRef(0);
    const lastChangeTimeRef = useRef(0);

    const handleIncrement = useCallback(() => {
      setValue((prev) =>
        prev === undefined
          ? (stepper ?? 1)
          : Math.min(prev + (stepper ?? 1), max),
      );
    }, [stepper, max]);

    const handleDecrement = useCallback(() => {
      setValue((prev) =>
        prev === undefined
          ? -(stepper ?? 1)
          : Math.max(prev - (stepper ?? 1), min),
      );
    }, [stepper, min]);

    const getIntervalDuration = useCallback((holdTime: number) => {
      // Start at 500ms, gradually decrease to 50ms over 2 seconds
      const maxHoldTime = 2000; // 2 seconds to reach max speed
      const minInterval = 50; // Fastest interval (50ms)
      const maxInterval = 500; // Slowest interval (500ms)

      if (holdTime >= maxHoldTime) return minInterval;

      const progress = holdTime / maxHoldTime;
      return maxInterval - progress * (maxInterval - minInterval);
    }, []);

    const startContinuousChange = useCallback(
      (direction: "up" | "down") => {
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
      },
      [handleIncrement, handleDecrement, getIntervalDuration],
    );

    const stopContinuousChange = useCallback(() => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    }, []);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const inputRef = ref as React.RefObject<HTMLInputElement>;
        if (inputRef?.current && document.activeElement === inputRef.current) {
          if (e.key === "ArrowUp") {
            handleIncrement();
          } else if (e.key === "ArrowDown") {
            handleDecrement();
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [handleIncrement, handleDecrement, ref]);

    const [prevControlledValue, setPrevControlledValue] = useState(controlledValue);
    if (controlledValue !== undefined && controlledValue !== prevControlledValue) {
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
          const inputEl = (ref as React.RefObject<HTMLInputElement>).current;
          if (inputEl) inputEl.value = String(min);
        } else if (value > max) {
          setValue(max);
          const inputEl = (ref as React.RefObject<HTMLInputElement>).current;
          if (inputEl) inputEl.value = String(max);
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
          className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          getInputRef={ref}
          {...props}
        />

        <div className="flex flex-col">
          <Button
            type="button"
            aria-label="Increase value"
            className="border-input h-4 rounded-l-none rounded-br-none border-b-[0.5px] border-l-0 px-2 focus-visible:relative"
            variant="outline"
            onMouseDown={() => startContinuousChange("up")}
            onMouseUp={stopContinuousChange}
            onMouseLeave={stopContinuousChange}
            disabled={value === max}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            type="button"
            aria-label="Decrease value"
            className="border-input h-4 rounded-l-none rounded-tr-none border-t-[0.5px] border-l-0 px-2 focus-visible:relative"
            variant="outline"
            onMouseDown={() => startContinuousChange("down")}
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