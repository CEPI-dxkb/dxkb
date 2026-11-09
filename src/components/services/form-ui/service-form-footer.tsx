"use client";

import { type AnyFormApi } from "@tanstack/react-form";

import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ServiceFormFooterProps {
  /** The page's form, read by the submit error shown above the buttons. */
  form: AnyFormApi;
  onReset: () => void;
  isSubmitting: boolean;
  /** Everything that keeps Submit off besides `isSubmitting`, which the footer adds. */
  submitDisabled: boolean;
  /** Submit button text, "Submit" unless the service names its action. */
  submitLabel?: string;
  /** Layout classes for the `service-form-controls` row (grid spans). */
  className?: string;
  /** Classes for the submitting spinner, merged after its `size-4` default. */
  spinnerClassName?: string;
}

/**
 * The Submit row of a service form: the last failed submission
 * (`ServiceSubmitError`) above a `service-form-controls` row holding an
 * outline Reset and a Submit that shows a spinner while the job is being
 * submitted. A page whose footer needs more (extra buttons, a Reset that is
 * disabled while submitting, an inner button wrapper) keeps its own markup.
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
