import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Local edit: `variant` is rendered as data-variant, like `size`, and the
// base classes key on it. panel: organism chart and section cards. tile:
// compact KPI and genus tiles. panel-error: a panel reporting a failed
// section (CardTitle turns destructive inside it). raised: a bordered,
// shadowed results card.
function Card({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  variant?: "default" | "panel" | "tile" | "panel-error" | "raised"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn("group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 data-[variant=panel]:rounded-lg data-[variant=panel-error]:rounded-lg data-[variant=panel-error]:bg-destructive/5 data-[variant=raised]:rounded-lg data-[variant=raised]:border data-[variant=raised]:shadow-sm data-[variant=tile]:rounded-md *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

// Local edit: title variants. The variant's text size merges after the base,
// so it drops `leading-snug` for the size's own line height.
const cardTitleVariants = cva(
  "text-base leading-snug font-medium group-data-[size=sm]/card:text-sm group-data-[variant=panel-error]/card:text-destructive",
  {
    variants: {
      variant: {
        default: "",
        // The title of a full-page card (the auth pages).
        page: "text-2xl font-bold",
        // The title of a results section card.
        section: "text-xl font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function CardTitle({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardTitleVariants>) {
  return (
    <div
      data-slot="card-title"
      className={cn(cardTitleVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
