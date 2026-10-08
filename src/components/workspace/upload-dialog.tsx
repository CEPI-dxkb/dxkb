"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceUploadPanel } from "./upload-panel";

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPath: string;
  onUploadComplete: () => void;
}

export function UploadDialog({
  open,
  onOpenChange,
  targetPath,
  onUploadComplete,
}: UploadDialogProps) {
  const [isUploading, setIsUploading] = React.useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        // No closing mid-upload (Esc, the backdrop): the panel tracks the
        // upload and unmounts with the dialog, so a reopened one could start
        // a second upload alongside it.
        if (!next && isUploading) {
          details.cancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={!isUploading}>
        <DialogTitle>Upload</DialogTitle>
        <WorkspaceUploadPanel
          targetPath={targetPath}
          onCancel={() => {
            onOpenChange(false);
          }}
          onUploadComplete={onUploadComplete}
          onUploadingChange={setIsUploading}
        />
      </DialogContent>
    </Dialog>
  );
}
