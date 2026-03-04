"use client";

import { Construction } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface FileViewerConstructionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileViewerConstructionDialog({
  open,
  onOpenChange,
}: FileViewerConstructionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="flex items-center justify-center gap-2">
            <Construction className="h-6 w-6 text-amber-600" />
          </AlertDialogMedia>
          <AlertDialogTitle>File viewer coming soon</AlertDialogTitle>
          <AlertDialogDescription>
            The file viewer is still under construction. Please check back at a
            later date for this feature.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>OK</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
