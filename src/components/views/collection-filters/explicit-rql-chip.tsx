"use client";

import { useState } from "react";
import { Braces, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ExplicitRqlView } from "./types";

const rawQueryClasses =
  "rounded-md border border-border bg-muted/50 px-2 py-1.5 font-mono text-xs break-all";

export function ExplicitRqlChip({
  query,
  onClear,
}: {
  query: ExplicitRqlView;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { raw, clauses } = query;

  return (
    <div className="inline-flex h-8 max-w-56 shrink-0 items-stretch rounded-md border border-info/40 bg-info/10 text-2xs font-medium text-info has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Advanced query. Show details"
              className="flex min-w-0 flex-1 items-center gap-1 rounded-l-md pr-1.5 pl-2 outline-none hover:underline focus-visible:underline aria-expanded:underline"
            />
          }
        >
          <Braces aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">Advanced query</span>
        </PopoverTrigger>
        <PopoverContent align="end" variant="raised" className="w-96">
          <PopoverHeader>
            <PopoverTitle>Advanced query</PopoverTitle>
            <PopoverDescription>
              The link you followed set this query, for example from Advanced
              Search. The filters can&apos;t show or edit it.
            </PopoverDescription>
          </PopoverHeader>
          {clauses ? (
            <>
              <ul className="flex flex-col gap-1 text-xs">
                {clauses.map((clause, index) => (
                  <li
                    key={`${String(index)}:${clause}`}
                    className="rounded-md border border-border bg-muted/50 px-2 py-1 wrap-break-word"
                  >
                    {clause}
                  </li>
                ))}
              </ul>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  RQL
                </summary>
                <code className={`mt-1 block ${rawQueryClasses}`}>{raw}</code>
              </details>
            </>
          ) : (
            <code className={`block ${rawQueryClasses}`}>{raw}</code>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="self-start"
            onClick={() => {
              setOpen(false);
              onClear();
            }}
          >
            <X aria-hidden="true" className="size-3" />
            Remove query
          </Button>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label="Remove advanced query"
        onClick={onClear}
        className="flex w-7 shrink-0 items-center justify-center rounded-r-md border-l border-info/40 outline-none hover:bg-info/10 focus-visible:bg-info/10"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </div>
  );
}
