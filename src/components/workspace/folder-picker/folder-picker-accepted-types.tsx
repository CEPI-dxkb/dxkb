"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  isLongPickerTypeList,
  pickerTypeLabels,
  pickerTypePhrase,
} from "@/lib/services/workspace/picker-views";

/**
 * "Accepts Contigs or Reads files." A list too long to read in a sentence
 * (the Copilot's "any file") is a "52 file types" button whose popover lists
 * them alphabetically, so the instructions above it stay short.
 */
export function FolderPickerAcceptedTypes({
  types,
}: {
  types: readonly string[];
}) {
  if (!isLongPickerTypeList(types)) {
    return <>Accepts {pickerTypePhrase(types)}.</>;
  }
  const labels = pickerTypeLabels(types).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  return (
    <>
      Accepts{" "}
      <Popover>
        <PopoverTrigger
          render={<Button type="button" variant="link" size="text" />}
        >
          {labels.length} file types
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-80 overflow-y-auto">
          <ul
            aria-label="Accepted file types"
            className="flex flex-col gap-1 text-sm"
          >
            {labels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      .
    </>
  );
}
