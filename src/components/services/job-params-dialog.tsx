"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface JobParamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: Record<string, unknown>;
  serviceName?: string;
}

export function JobParamsDialog({
  open,
  onOpenChange,
  params,
  serviceName = "Job",
}: JobParamsDialogProps) {
  const formattedParams = JSON.stringify(params, null, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-175">
        <DialogHeader>
          <DialogTitle className="mr-6 flex items-center justify-between">
            {serviceName} Submission Params:
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 overflow-x-auto">
          <pre className="max-h-[60vh] overflow-x-scroll rounded-md bg-muted p-4 font-mono text-sm">
            {formattedParams}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
