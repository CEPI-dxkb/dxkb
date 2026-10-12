"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"
import { CircleIcon } from "lucide-react"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

// Local edit (keep when regenerating with `shadcn add --overwrite`): the
// circle uses `border-muted-foreground bg-background` instead of upstream's
// `border-input`, as Checkbox does. The light theme's `--input` is nearly
// white, so an unselected circle disappeared against the card. muted-foreground
// keeps the border above the 3:1 non-text contrast WCAG 1.4.11 asks of a
// control's boundary. An unselected, enabled and valid circle darkens its
// border to `foreground` on hover, so the radio shows it reacts to the pointer.
// The radio is a <span> (Base UI's input is a hidden 1px one), which `:disabled`
// never matches, so its not-allowed cursor and its dimming key on
// `data-disabled:`.
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-muted-foreground bg-background text-primary outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-unchecked:not-aria-invalid:not-data-disabled:hover:border-foreground dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center text-primary group-aria-invalid/radio-group-item:text-destructive"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-1/2 fill-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
