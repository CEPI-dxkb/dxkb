import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A field's error as one short line, with an info button that opens its full
 * text, for an error too long to sit under the field (a rejected genome group
 * lists a finding per check). The error's toast carries the full text too and
 * stays until it is closed, so the card shows only the summary.
 */
export function FieldErrorDetails({
  summary,
  details,
}: {
  summary: string;
  details: string;
}) {
  return (
    <div
      data-slot="form-message"
      className="flex items-center gap-1 text-sm text-destructive"
    >
      <span>{summary}</span>
      <Dialog>
        <DialogTrigger
          render={(triggerProps) => (
            <Button
              {...triggerProps}
              variant="ghost-destructive"
              size="icon-xs"
              aria-label={`Error details: ${summary}`}
            >
              <Info />
            </Button>
          )}
        />
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="w-full">
            <DialogTitle size="lg">{summary}</DialogTitle>
            <DialogDescription className="wrap-break-word whitespace-pre-line">
              {details}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
