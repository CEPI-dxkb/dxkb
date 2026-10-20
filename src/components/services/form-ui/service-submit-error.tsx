"use client";

import Link from "next/link";
import { useState } from "react";
import { type AnyFormApi } from "@tanstack/react-form";
import { useMutationState } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
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
 * form's `service-form-controls` row with the page's `form`; it reads the
 * submission from the mutation cache (`useServiceFormSubmission` tags it).
 *
 * The mutation cache outlives navigation, so only submissions started since
 * this component mounted count: a failure on another form, or on an earlier
 * visit to this one, never shows. A new submit clears it (its mutation is
 * pending, then succeeds or replaces the error).
 *
 * Reset clears it too: `form.reset()` sets the form's `submissionAttempts`
 * back to 0, and from then on only later submissions count. Hiding it while
 * the count is 0 would not do: a Submit that validation stops counts an
 * attempt without sending a job, and the old failure would come back.
 */
export function ServiceSubmitError({ form }: { form: AnyFormApi }) {
  const [mountedAt] = useState(() => Date.now());
  const attempts = useSelector(form.store, (s) => s.submissionAttempts);
  const [tracked, setTracked] = useState({ attempts, ignoreBefore: mountedAt });
  const submissions = useMutationState({
    filters: { mutationKey: [serviceSubmitMutationKey] },
    select: (mutation) => ({
      status: mutation.state.status,
      error: mutation.state.error,
      submittedAt: mutation.state.submittedAt,
    }),
  });

  const latest = submissions
    .filter((submission) => submission.submittedAt >= tracked.ignoreBefore)
    .reduce<(typeof submissions)[number] | undefined>(
      (newest, submission) =>
        !newest || submission.submittedAt >= newest.submittedAt
          ? submission
          : newest,
      undefined,
    );

  // Back to 0 attempts means Reset: drop every submission seen so far.
  if (tracked.attempts !== attempts) {
    setTracked({
      attempts,
      ignoreBefore:
        attempts === 0 && latest
          ? latest.submittedAt + 1
          : tracked.ignoreBefore,
    });
  }

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
