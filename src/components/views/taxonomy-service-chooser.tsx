"use client";

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
              rerunJob(taxonomyBlastPrefill(taxonIds), "Homology");
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
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
