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
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            {serviceName} Submission Params:
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 overflow-x-auto">
          <pre className="bg-muted p-4 rounded-md max-h-[60vh] text-sm font-mono overflow-x-scroll">
            {formattedParams}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
