"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  describeServiceSubmitError,
  serviceSubmitMutationKey,
} from "@/hooks/services/use-service-form-submission";

/**
 * The page's last failed job submission, shown by the Submit row so the
 * reason stays on screen after the toast has gone. Render it right before the
 * form's `service-form-controls` row; it reads the submission from the
 * mutation cache (`useServiceFormSubmission` tags it), so it needs no props.
 *
 * The mutation cache outlives navigation, so only submissions started since
 * this component mounted count: a failure on another form, or on an earlier
 * visit to this one, never shows. A new submit clears it (its mutation is
 * pending, then succeeds or replaces the error).
 */
export function ServiceSubmitError() {
  const [mountedAt] = useState(() => Date.now());
  const submissions = useMutationState({
    filters: { mutationKey: [serviceSubmitMutationKey] },
    select: (mutation) => ({
      status: mutation.state.status,
      error: mutation.state.error,
      submittedAt: mutation.state.submittedAt,
    }),
  });

  const latest = submissions
    .filter((submission) => submission.submittedAt >= mountedAt)
    .reduce<(typeof submissions)[number] | undefined>(
      (newest, submission) =>
        !newest || submission.submittedAt >= newest.submittedAt
          ? submission
          : newest,
      undefined,
    );

  if (latest?.status !== "error") return null;

  const { title, message, mayHaveBeenQueued } = describeServiceSubmitError(
    latest.error,
  );

  return (
    // col-span-full: some forms are grids, and the alert spans the row the
    // Submit buttons sit in; outside a grid it has no effect.
    <Alert variant="destructive" className="col-span-full">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {mayHaveBeenQueued ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/jobs" />}
          >
            View Jobs
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
