import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { thresholdOptions } from "@/lib/forms/tree-threshold-options";

const thresholdItems = thresholdOptions.map((value) => ({
  value,
  label: value,
}));

/**
 * A label and the 0 to 1 threshold select shared by the tree services. It is
 * presentational: the page owns the `form.Field`, `FieldItem` and
 * `FieldErrors`, and passes its own label element.
 */
export function TreeThresholdSelect({
  label,
  ariaLabel,
  value,
  onValueChange,
}: {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <>
      {label}
      <Select
        items={thresholdItems}
        value={value}
        onValueChange={(next) => {
          if (next != null) onValueChange(next);
        }}
      >
        <ServiceSelectTrigger aria-label={ariaLabel}>
          <SelectValue placeholder="Select" />
        </ServiceSelectTrigger>
        <SelectContent>
          <SelectGroup>
            {thresholdOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}
