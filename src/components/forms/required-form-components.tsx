import { ServiceCardTitle } from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";

/** A service form card title with a required-field marker. */
export function RequiredFormCardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ServiceCardTitle className={`gap-1 ${className ?? ""}`}>
      {children}
      <span className="text-red-500">*</span>
    </ServiceCardTitle>
  );
}

import { Label } from "@/components/ui/label";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceInfoPopup } from "@/types/services";

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
      <ServiceLabel className={`mb-0! ${className ?? ""}`}>
        {label}
      </ServiceLabel>
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
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={`gap-1 ${className ?? ""}`}>
      {children}
      <span className="gap-1 text-red-500">*</span>
    </Label>
  );
}
