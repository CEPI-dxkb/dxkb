"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CitationNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center space-x-1 bg-muted/40 p-1 rounded-lg w-fit">
      <Link
        href="/citations"
        className={cn(buttonVariants({ variant: pathname === "/citations" ? "default" : "ghost", size: "sm" }), "rounded-md")}
      >
        Dashboard
      </Link>
      <Link
        href="/citations/timeline"
        className={cn(buttonVariants({ variant: pathname === "/citations/timeline" ? "default" : "ghost", size: "sm" }), "rounded-md")}
      >
        Timeline
      </Link>
      <Link
        href="/citations/metrics"
        className={cn(buttonVariants({ variant: pathname === "/citations/metrics" ? "default" : "ghost", size: "sm" }), "rounded-md")}
      >
        Metrics
      </Link>
    </div>
  )
}

