import * as React from "react"
import { cn } from "@/lib/utils"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "flex w-fit min-w-8 shrink-0 items-center justify-center self-start overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
}

// Local edit: `density="compact"` tightens the gap between the bubble and its footer, for chat
// surfaces that are short on height.
function MessageContent({
  className,
  density = "default",
  ...props
}: React.ComponentProps<"div"> & { density?: "default" | "compact" }) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        density === "compact" ? "gap-1" : "gap-2.5",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  )
}

function MessageFooter({
  className,
  reveal = "always",
  ...props
}: React.ComponentProps<"div"> & { reveal?: "always" | "hover" }) {
  return (
    <div
      data-slot="message-footer"
      data-reveal={reveal}
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground transition-opacity duration-150 ease-out group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end data-[reveal=hover]:opacity-0 group-focus-within/message:data-[reveal=hover]:opacity-100 group-hover/message:data-[reveal=hover]:opacity-100 pointer-coarse:data-[reveal=hover]:opacity-100",
        className
      )}
      {...props}
    />
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
}
