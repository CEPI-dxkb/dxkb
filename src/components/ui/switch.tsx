"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

// Local edit (keep when regenerating with `shadcn add --overwrite`): the
// unchecked state reads like an unselected Checkbox or RadioGroupItem: a
// `border-muted-foreground bg-background` track with a `bg-muted-foreground`
// thumb, and a border that darkens to `foreground` on hover. Upstream's
// `bg-input` track is nearly white in the light themes (1.04-1.14:1 against the
// service card), so an "off" switch disappeared. muted-foreground keeps the
// ring and the thumb above the 3:1 non-text contrast WCAG 1.4.11 asks of a
// control's boundary in all six themes. The dark-theme `bg-input/80` track and
// `bg-foreground` thumb overrides are gone: the dark thumb takes the same
// muted-foreground, so the ring and the thumb read as one pair. The `not-*`
// guards let the focus (`border-ring`) and invalid (`border-destructive`)
// borders win: the unchecked border ties them at the same specificity and
// sorts last. The hover guards also keep a disabled switch from reacting, as
// on Checkbox and RadioGroupItem.
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 data-unchecked:bg-background data-unchecked:not-focus-visible:not-aria-invalid:border-muted-foreground data-unchecked:not-aria-invalid:not-data-disabled:hover:border-foreground data-[size=default]:h-[18.4px] data-[size=default]:w-8 data-[size=sm]:h-[14px] data-[size=sm]:w-6 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] data-unchecked:bg-muted-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-checked:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
