"use client";

import { useState } from "react";
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
  hasSelectableServices?: boolean;
}

export function TaxonomyServiceChooser({
  open,
  onOpenChange,
  taxonIds,
  hasSelectableServices = true,
}: TaxonomyServiceChooserProps) {
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(open);

  // Each opening starts without the previous session's error.
  if (lastOpen !== open) {
    setLastOpen(open);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use selected Taxa in a service</DialogTitle>
          <DialogDescription>
            Open a supported service with {taxonIds.length.toLocaleString()} selected
            Taxon {taxonIds.length === 1 ? "ID" : "IDs"} prefilled.
          </DialogDescription>
        </DialogHeader>
        {hasSelectableServices ? (
          <Button
            onClick={() => {
              // The launch is synchronous, so there is no tab to reserve — but a
              // pop-up blocker can still refuse it, and closing the dialog then
              // reported a success that never happened.
              const launch = rerunJob(
                taxonomyBlastPrefill(taxonIds),
                "Homology",
              );
              if (launch.status !== "opened") {
                setError(launch.message);
                return;
              }
              onOpenChange(false);
            }}
          >
            BLAST against selected Taxa
          </Button>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No selectable services
          </p>
        )}
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
