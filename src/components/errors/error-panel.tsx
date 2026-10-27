import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";

interface ErrorPanelProps {
  title: string;
  /** `h1` when the panel replaces the page, `h2` inside a page's own header. */
  headingLevel?: "h1" | "h2";
  message: string;
  /** Next's digest for a redacted server error, so a report can be matched to the server log. */
  reference?: string;
  /** The Retry button (`RetryButton` or `RefreshRetryButton`). */
  retry: ReactNode;
  backHref?: string;
  backLabel?: string;
}

/**
 * The error a page shows in place of content it could not load: the
 * collection tables' destructive Alert (`role="alert"`, a title, the condensed
 * message, a Retry that refetches) plus a way back to the list.
 */
export function ErrorPanel({
  title,
  headingLevel: Heading = "h1",
  message,
  reference,
  retry,
  backHref,
  backLabel,
}: ErrorPanelProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>
        <Heading>{title}</Heading>
      </AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {reference && (
          <p>
            Reference: <code>{reference}</code>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {retry}
          {backHref && backLabel && (
            <Link
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={backHref}
            >
              {backLabel}
            </Link>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
