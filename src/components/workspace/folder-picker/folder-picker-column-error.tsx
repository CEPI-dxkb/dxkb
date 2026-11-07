import { QueryRetryButton } from "@/components/views/query-retry-button";
import { formatUserFacingErrorMessage } from "@/lib/utils";

interface FolderPickerColumnErrorProps {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}

/** A column whose listing failed: the backend's message and a Retry. */
export function FolderPickerColumnError({
  error,
  retrying,
  onRetry,
}: FolderPickerColumnErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-1 p-2 text-xs">
      <p className="font-medium text-destructive">
        Couldn&apos;t load this folder.
      </p>
      <p className="wrap-break-word text-muted-foreground">
        {formatUserFacingErrorMessage(
          error,
          "The workspace service gave no reason.",
        )}
      </p>
      <QueryRetryButton retrying={retrying} onRetry={onRetry} />
    </div>
  );
}
