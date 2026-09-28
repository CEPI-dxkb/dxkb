import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edit: variants. inverse: a light pulse on a dark or brand surface
// (the statistics band).
const skeletonVariants = cva("animate-pulse rounded-md bg-muted", {
  variants: {
    variant: {
      default: "",
      inverse: "bg-white/20",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Skeleton({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Skeleton }
