import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyHref, metadataLinkClassName } from "./metadata-link-policy";

/**
 * The rendering half of the metadata-link boundary. Classification and template
 * resolution live in the sibling `./metadata-link-policy` module; everything
 * here turns an already-classified destination into markup.
 */

export interface MetadataLinkProps {
  href: string;
  children: ReactNode;
  /**
   * Extra classes merged onto {@link metadataLinkClassName} for a call site
   * that needs additional layout (e.g. `inline-flex` to seat a trailing icon).
   */
  className?: string;
  /**
   * Content rendered after `children`, and **only** when the destination
   * classifies as `"external"`. Keeping the new-tab affordance behind the same
   * classification that chose the anchor means a call site cannot label an
   * internal destination as external, or vice versa.
   */
  externalIndicator?: ReactNode;
}

/**
 * One metadata link: internal destinations through Next `Link`, external
 * destinations as a safe new-tab anchor, and an unsafe destination as nothing
 * at all (see {@link classifyHref}). The one place that decision is made for
 * anchor-shaped links.
 */
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

/** Same internal/external/unsafe contract as {@link MetadataLink}, wrapped
 * in the shared `Button` styling for `linkType: "button"` fields. */
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
