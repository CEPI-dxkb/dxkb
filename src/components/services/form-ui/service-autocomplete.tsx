import { ChevronDown } from "lucide-react";
import type * as React from "react";

import { ServiceInput } from "@/components/services/form-ui/service-input";
import {
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteTrigger,
} from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";

/**
 * The text field of an `<Autocomplete>` in a service form: a service input
 * with the pickers' chevron chip at its end, which opens the suggestions as
 * the workspace pickers' toggle does. The props go to the input; the root
 * owns its value.
 */
export function ServiceAutocompleteInput({
  className,
  triggerLabel = "Show suggestions",
  ...props
}: React.ComponentProps<typeof AutocompleteInput> & {
  /** The chevron button's accessible name. */
  triggerLabel?: string;
}) {
  return (
    <AutocompleteInputGroup className={className}>
      <AutocompleteInput
        render={<ServiceInput inset="end" className="w-full" />}
        {...props}
      />
      <AutocompleteTrigger
        render={
          <Button
            type="button"
            variant="soft"
            aria-label={triggerLabel}
            className="group/autocomplete-trigger absolute top-1/2 right-3 size-4 -translate-y-1/2"
          />
        }
      >
        <ChevronDown className="size-4 transition-transform group-data-popup-open/autocomplete-trigger:rotate-180" />
      </AutocompleteTrigger>
    </AutocompleteInputGroup>
  );
}
