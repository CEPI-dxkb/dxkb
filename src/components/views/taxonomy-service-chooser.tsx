"use client";

import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rerunJob } from "@/lib/rerun-utility";
import { taxonomyBlastPrefill } from "@/lib/taxonomy-view";

interface TaxonomyServiceChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxonIds: readonly string[];
  /**
   * The control that opened the dialog, which takes focus back when it closes.
   * The dialog has no `DialogTrigger`, so it otherwise returns focus to whatever
   * was focused as it opened: the body, when the opening button was disabled
   * while its action loaded.
   */
  finalFocus?: RefObject<HTMLElement | null>;
}

export function TaxonomyServiceChooser({
  open,
  onOpenChange,
  taxonIds,
  finalFocus,
}: TaxonomyServiceChooserProps) {
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(open);

  if (lastOpen !== open) {
    setLastOpen(open);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Use selected Taxa in a service</DialogTitle>
          <DialogDescription>
            Open a supported service with {taxonIds.length.toLocaleString()} selected
            Taxon {taxonIds.length === 1 ? "ID" : "IDs"} prefilled.
          </DialogDescription>
        </DialogHeader>
        <Button
          onClick={() => {
            // The launch is synchronous, but a pop-up blocker can still refuse
            // it; closing the dialog then would report a success that never
            // happened.
            const launch = rerunJob(taxonomyBlastPrefill(taxonIds), "Homology");
            if (launch.status !== "opened") {
              setError(launch.message);
              return;
            }
            onOpenChange(false);
          }}
        >
          BLAST against selected Taxa
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
