"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"

export function CitationNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center space-x-1 bg-muted/40 p-1 rounded-lg w-fit">
      <Button variant={pathname === "/citations" ? "default" : "ghost"} size="sm" className="rounded-md" asChild>
        <Link href="/citations">Dashboard</Link>
      </Button>
      <Button
        variant={pathname === "/citations/timeline" ? "default" : "ghost"}
        size="sm"
        className="rounded-md"
        asChild
      >
        <Link href="/citations/timeline">Timeline</Link>
      </Button>
      <Button
        variant={pathname === "/citations/metrics" ? "default" : "ghost"}
        size="sm"
        className="rounded-md"
        asChild
      >
        <Link href="/citations/metrics">Metrics</Link>
      </Button>
    </div>
  )
}

