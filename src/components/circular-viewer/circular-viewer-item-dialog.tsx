"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FigureHit } from "@/lib/circular-viewer/drawing";
import { featureHref } from "@/lib/views/hrefs";
import { ItemFieldList, itemTitle } from "./circular-viewer-item-fields";

/**
 * Legacy's click dialog (`formatDialogContent`): every field, and a way to the record.
 * Nothing triggers it, so on close `returnFocus` puts focus back (on the figure).
 */
export function CircularViewerItemDialog({
  hit,
  onClose,
  returnFocus,
}: {
  hit: FigureHit | null;
  onClose: () => void;
  returnFocus: () => void;
}) {
  return (
    <Dialog
      open={hit !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        finalFocus={() => {
          returnFocus();
          return false;
        }}
      >
        {hit && (
          <>
            <DialogHeader>
              <DialogTitle>{itemTitle(hit.item)}</DialogTitle>
            </DialogHeader>
            <div className="text-sm">
              <ItemFieldList item={hit.item} full />
            </div>
            {hit.item.kind === "feature" && (
              <Link
                href={featureHref(hit.item.feature.featureId)}
                className="text-sm text-link hover:underline dark:hover:text-foreground"
              >
                Open Feature View
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
