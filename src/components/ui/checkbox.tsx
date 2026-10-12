"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

// Local edit (keep when regenerating with `shadcn add --overwrite`): the
// unchecked box uses `border-muted-foreground bg-background` instead of
// upstream's `border-input`. The light theme's `--input` is nearly white, so
// an empty box disappeared, most of all on muted surfaces such as the
// influenza HA subtype scheme grid. muted-foreground keeps the border above
// the 3:1 non-text contrast WCAG 1.4.11 asks of a control's boundary. An
// unchecked, enabled and valid box darkens its border to `foreground` on hover,
// so the checkbox shows it reacts to the pointer. The box is a <span> (Base
// UI's input is a hidden 1px one), which `:disabled` never matches, so its
// not-allowed cursor and its dimming key on `data-disabled:`.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-muted-foreground bg-background transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 data-unchecked:not-aria-invalid:not-data-disabled:hover:border-foreground dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
