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
import { Separator } from "@/components/ui/separator";
import { ServiceInfoPopup } from "@/types/services";
import { cn } from "@/lib/utils";

export function DialogInfoPopup({
  title,
  description,
  sections = [],
  isHeader = false,
  className,
}: ServiceInfoPopup & { isHeader?: boolean; className?: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            variant={isHeader ? "ghost-accent-primary" : "ghost-accent"}
            size="icon"
            aria-label={`More info: ${title}`}
            className={cn(
              !isHeader && "size-5",
              "hover:cursor-pointer",
              className,
              triggerProps.className,
            )}
          >
            <Info
              className={cn({
                "h-6! w-6! font-bold!": isHeader,
                "h-4! w-4!": !isHeader,
              })}
              strokeWidth={isHeader ? 3 : 2}
            />
          </Button>
        )}
      />

      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="w-full">
          <DialogTitle size="lg">{title}</DialogTitle>
          <DialogDescription className="overflow-x-auto break-all">
            {description}
          </DialogDescription>
        </DialogHeader>
        {sections.length > 0 && (
          <div className="max-h-128 space-y-4 overflow-y-auto rounded-md border bg-card p-4 py-4">
            {sections.map((section, index) => (
              <div
                key={`${section.header ?? "section"}:${section.description ?? ""}`}
                className="space-y-3"
              >
                {section.header && (
                  <h3 className="text-base font-semibold text-foreground">
                    {section.header}
                  </h3>
                )}
                {section.description && (
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                )}
                {section.subsections && section.subsections.length > 0 && (
                  <div className="space-y-4">
                    {section.subsections.map((subsection) => (
                      <div
                        key={`${subsection.subheader}:${String(subsection.subdescription)}`}
                        className="space-y-1"
                      >
                        <h5 className="text-sm font-medium">
                          {subsection.subheader}
                        </h5>
                        <p className="mb-2 ml-4 text-sm text-muted-foreground">
                          {subsection.subdescription}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {index < sections.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
