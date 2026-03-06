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
      <Label className={`service-card-label !mb-0 ${className}`}>
        {label}
      </Label>
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
    <Label className={`gap-1 ${className}`}>
      {children}
      <span className="gap-1 text-red-500">*</span>
    </Label>
  );
}
