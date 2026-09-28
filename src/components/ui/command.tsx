"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { SearchIcon, CheckIcon } from "lucide-react"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  children?: React.ReactNode
}) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
        {children ? (
          <InputGroupAddon align="inline-end" className="gap-1.5 pr-1.5">
            {children}
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  )
}

function CommandShortcutChip({
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="command-shortcut-chip"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted/40 px-1 font-sans text-[10px] font-medium text-foreground/80",
        className
      )}
      {...props}
    />
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-foreground/80 **:[[cmdk-group-heading]]:uppercase", className)}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

// Local edit (keep when regenerating with `shadcn add --overwrite`): the
// CommandItem `variant` axis. `app-selection` is for lists whose highlighted
// row is the app's selection (`data-app-selected`) rather than cmdk's keyboard
// cursor: it neutralises cmdk's `data-selected` fill and forces the app
// selection to win when a row is both.
const commandItemVariants = cva("", {
  variants: {
    variant: {
      default: "",
      "app-selection":
        "hover:bg-secondary/15 data-[app-selected=true]:bg-secondary/25! data-[app-selected=true]:font-medium data-[selected=true]:bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function CommandItem({
  className,
  children,
  description,
  badge,
  variant,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> &
  VariantProps<typeof commandItemVariants> & {
    description?: string
    badge?: React.ReactNode
  }) {
  const itemClassName = cn(
    "data-[selected=true]:bg-secondary/8 data-[selected=true]:text-foreground data-[selected=true]:*:[svg]:text-foreground",
    "relative flex cursor-default items-center gap-2 rounded-sm text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg!",
    description ? "px-3 py-2.5" : "px-2 py-1.5",
    "group/command-item data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    commandItemVariants({ variant }),
    className
  )

  let body: React.ReactNode
  if (description) {
    const [icon, ...rest] = React.Children.toArray(children)
    body = (
      <>
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{rest}</span>
            {badge}
          </div>
          <span className="truncate text-xs text-foreground/80">
            {description}
          </span>
        </div>
      </>
    )
  } else {
    body = (
      <>
        {children}
        {badge}
      </>
    )
  }

  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={itemClassName}
      {...props}
    >
      {body}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground", className)}
      {...props}
    />
  )
}

function CommandFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-footer"
      className={cn(
        "flex items-center gap-4 border-t px-3 py-2 text-xs text-foreground/80",
        className
      )}
      {...props}
    />
  )
}

function CommandFooterHint({
  keys,
  children,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  keys: string[]
  children: React.ReactNode
}) {
  return (
    <span
      data-slot="command-footer-hint"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {keys.map((key) => (
        <CommandShortcutChip key={key}>{key}</CommandShortcutChip>
      ))}
      <span>{children}</span>
    </span>
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandShortcutChip,
  CommandSeparator,
  CommandFooter,
  CommandFooterHint,
}
