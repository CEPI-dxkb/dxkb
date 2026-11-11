import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface LookupErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

/**
 * A failed field lookup, announced with the server's reason and a Retry so an
 * outage never reads as an empty result.
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
            // Keeps focus in the field so the suggestion list stays open to
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
