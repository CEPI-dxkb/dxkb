import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyHref, metadataLinkClassName } from "./metadata-link-policy";

export interface MetadataLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** Rendered only when the destination classifies as `"external"`. */
  externalIndicator?: ReactNode;
}

/** An unsafe destination renders nothing (see {@link classifyHref}). */
export function MetadataLink({
  href,
  children,
  className,
  externalIndicator,
}: MetadataLinkProps) {
  const classification = classifyHref(href);
  if (classification === "external") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(metadataLinkClassName, className)}
      >
        {children}
        {externalIndicator}
      </a>
    );
  }
  if (classification === "internal") {
    return (
      <Link href={href} className={cn(metadataLinkClassName, className)}>
        {children}
      </Link>
    );
  }
  return null;
}

export function MetadataLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const classification = classifyHref(href);
  if (classification === "external") {
    return (
      <Button
        nativeButton={false}
        render={<a href={href} target="_blank" rel="noopener noreferrer" />}
        size="sm"
      >
        {children}
      </Button>
    );
  }
  if (classification === "internal") {
    return (
      <Button
        nativeButton={false}
        render={<Link href={href} />}
        size="sm"
      >
        {children}
      </Button>
    );
  }
  return null;
}
