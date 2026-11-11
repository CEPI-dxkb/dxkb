import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUserFacingErrorMessage } from "@/lib/utils";

import { SectionRetryButton } from "./section-retry-button";

/** `formatUserFacingErrorMessage` fallback for an error that says nothing. */
const genericSectionErrorMessage =
  "This section could not be loaded. Please try again.";

interface SectionErrorProps {
  /** What the section shows, as the start of a sentence: "Reference genomes" titles the card "Reference genomes could not be loaded". */
  section: string;
  /** What failed: the caught error, or a message. Long messages are condensed. */
  error: unknown;
  /** Re-runs a browser-owned load; without it Retry refreshes the route. `false` omits Retry for failures loading again cannot fix. */
  onRetry?: (() => void) | false;
  /** The caller's load is running again (`useRetryKeepingError`'s `retrying`). */
  isRetrying?: boolean;
}

/** A section or panel whose data could not load: a title, the condensed real message and a Retry, announced as an alert. */
export function SectionError({
  section,
  error,
  onRetry,
  isRetrying,
}: SectionErrorProps) {
  const message = formatUserFacingErrorMessage(
    typeof error === "string" ? new Error(error) : error,
    genericSectionErrorMessage,
  );

  return (
    <Card variant="panel-error" role="alert">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" />
            {section} could not be loaded
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <p
          data-testid="section-error-message"
          className="text-sm wrap-break-word text-foreground"
        >
          {message}
        </p>
        {onRetry !== false && (
          <SectionRetryButton onRetry={onRetry} isRetrying={isRetrying} />
        )}
      </CardContent>
    </Card>
  );
}
