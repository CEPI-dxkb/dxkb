"use client";

import { type AnyFormApi } from "@tanstack/react-form";

import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ServiceFormFooterProps {
  form: AnyFormApi;
  onReset: () => void;
  isSubmitting: boolean;
  submitDisabled: boolean;
  submitLabel?: string;
  className?: string;
  spinnerClassName?: string;
}

/**
 * The Submit row: the last failed submission above Reset and Submit buttons. A
 * page needing more keeps its own markup.
 */
export function ServiceFormFooter({
  form,
  onReset,
  isSubmitting,
  submitDisabled,
  submitLabel = "Submit",
  className,
  spinnerClassName,
}: ServiceFormFooterProps) {
  return (
    <>
      <ServiceSubmitError form={form} />
      <div className={cn("service-form-controls", className)}>
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
        <Button type="submit" disabled={isSubmitting || submitDisabled}>
          {isSubmitting ? <Spinner className={spinnerClassName} /> : null}
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
