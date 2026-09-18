import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyHref } from "./metadata-link-policy";

/**
 * The rendering half of the metadata-link boundary. Classification and template
 * resolution live in the sibling `./metadata-link-policy` module; everything
 * here turns an already-classified destination into markup.
 */

/**
 * Shared visual treatment for the detail panel's metadata-driven links —
 * scalar, array and button alike — so internal and external destinations look
 * identical regardless of which shape produced them. Not repo-wide: the
 * collection table styles the same `DataField.link` templates through its own
 * `valueHref` path with a different class string, which
 * `./metadata-link-policy` records alongside the classification boundary that
 * path also bypasses.
 */
export const metadataLinkClassName =
  "text-primary underline hover:text-primary/80";

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

/**
 * Imperative wrapper around {@link MetadataLink} for the detail panel's
 * `render`-callback field shape, which builds nodes rather than composing JSX.
 */
export function renderMetadataLink(
  href: string,
  label: ReactNode,
  key?: string,
): ReactNode {
  return (
    <MetadataLink key={key} href={href}>
      {label}
    </MetadataLink>
  );
}

/** Same internal/external/unsafe contract as {@link MetadataLink}, wrapped
 * in the shared `Button` styling for `linkType: "button"` fields. */
export function renderMetadataLinkButton(
  href: string,
  label: ReactNode,
): ReactNode {
  const buttonClassName =
    "rounded border-black bg-primary px-2 py-1 text-sm text-secondary";
  const classification = classifyHref(href);
  if (classification === "external") {
    return (
      <Button
        nativeButton={false}
        render={<a href={href} target="_blank" rel="noopener noreferrer" />}
        className={buttonClassName}
      >
        {label}
      </Button>
    );
  }
  if (classification === "internal") {
    return (
      <Button
        nativeButton={false}
        render={<Link href={href} />}
        className={buttonClassName}
      >
        {label}
      </Button>
    );
  }
  return null;
}
