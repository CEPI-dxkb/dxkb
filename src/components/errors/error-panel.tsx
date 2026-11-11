import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";

interface ErrorPanelProps {
  title: string;
  headingLevel?: "h1" | "h2";
  message: string;
  reference?: string;
  retry: ReactNode;
  backHref?: string;
  backLabel?: string;
}

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
