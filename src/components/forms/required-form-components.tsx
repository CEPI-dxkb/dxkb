import { CardTitle } from "@/components/ui/card";

export function RequiredFormCardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <CardTitle className={`gap-1 ${className}`}>
      {children}
      <span className="text-red-500">*</span>
    </CardTitle>
  );
}

import { FormLabel } from "@/components/ui/form";
import { DialogInfoPopup } from "../services/dialog-info-popup";
import { ServiceInfoPopup } from "@/types/services";
import { Spade } from "lucide-react";

interface RequiredFormLabelInfoProps {
  className?: string;
  label: string;
  infoPopup: ServiceInfoPopup;
}

export function RequiredFormLabelInfo({
  className,
  label,
  infoPopup,
}: RequiredFormLabelInfoProps) {
  return (
    <div className="flex flex-row items-center gap-1">
      <FormLabel className={`service-card-label !mb-0 ${className}`}>
        {label}
      </FormLabel>
      <DialogInfoPopup
        title={infoPopup.title}
        description={infoPopup.description}
        sections={infoPopup.sections}
      />
      <span className="text-red-500">*</span>
    </div>
  );
}

export function RequiredFormLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <FormLabel className={`gap-1 ${className}`}>
      {children}
      <span className="gap-1 text-red-500">*</span>
    </FormLabel>
  );
}
