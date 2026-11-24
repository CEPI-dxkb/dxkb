import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface MobileNavLinkProps {
  href: string;
  target?: string;
  children: ReactNode;
}

export function MobileNavLink({ href, target, children }: MobileNavLinkProps) {
  const isExternal = target === "_blank";
  return (
    <Link
      href={href}
      target={target}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group/link flex items-center gap-2 rounded-md p-2 text-sm text-foreground/75 transition-colors hover:bg-secondary/8 hover:text-foreground"
    >
      {children}
      {isExternal && (
        <>
          <ExternalLink
            className="size-3 text-muted-foreground transition-colors group-hover/link:text-secondary"
            strokeWidth={2.75}
            aria-hidden="true"
          />{" "}
          <span className="sr-only">(opens in a new tab)</span>
        </>
      )}
    </Link>
  );
}
