import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface LookupErrorAlertProps {
  /** What failed and why ("Taxonomy search unavailable: …"). */
  message: string;
  /** Runs the lookup again; without it the alert offers no Retry. */
  onRetry?: () => void;
}

/**
 * A failed field lookup (genome or taxonomy autocomplete): announced, with
 * the server's reason and a Retry, so an outage never reads as an empty
 * result or as the user's mistake.
 */
export function LookupErrorAlert({ message, onRetry }: LookupErrorAlertProps) {
  return (
    <Alert variant="destructive" size="sm">
      <CircleAlert aria-hidden />
      <AlertDescription>
        <p>{message}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            // Keeps focus in the field, so a suggestion list stays open to
            // show what the retry finds.
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
