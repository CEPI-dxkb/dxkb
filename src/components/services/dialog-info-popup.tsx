import { Info } from 'lucide-react';

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
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            isHeader
              ? "h-8 w-8 rounded-full p-2 text-primary font-bold"
              : "h-5 w-5 rounded-full p-0.5",
            "hover:bg-accent hover:text-accent-foreground hover:cursor-pointer",
            className,
          )}
        >
          <Info className={cn({ "!h-6 !w-6 !font-bold": isHeader, "!h-4 !w-4": !isHeader })} strokeWidth={isHeader ? 3 : 2} />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="w-full">
          <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-foreground/70 overflow-x-auto break-all">{description}</DialogDescription>
        </DialogHeader>
        {sections.length > 0 && (
          <div className="max-h-128 space-y-4 overflow-y-auto rounded-md border bg-white p-4 py-4">
          {sections.map((section, index) => (
            <div key={index} className="space-y-3">
              {section.header && (
                <h3 className="text-base font-semibold">{section.header}</h3>
              )}
              {/* {section.subheader && (
                <h4 className="text-muted-foreground text-sm font-medium">
                  {section.subheader}
                </h4>
              )} */}
              {section.description && (
                <p className="text-muted-foreground text-sm">
                  {section.description}
                </p>
              )}
              {section.subsections && section.subsections.length > 0 && (
                <div className="ml-4 space-y-4">
                  {section.subsections.map((subsection, subIndex) => (
                    <div key={subIndex} className="space-y-1">
                      <h5 className="text-sm font-medium">
                        {subsection.subheader}
                      </h5>
                      <p className="text-muted-foreground text-sm mb-2">
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
        {/* <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="text-white">
              Close
            </Button>
          </DialogClose>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
}
