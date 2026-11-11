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
 * The page's last failed submission, so the reason stays after the toast goes.
 * Only submissions started since mount count, because the mutation cache
 * outlives navigation.
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

  // Reset sets `submissionAttempts` to 0; hiding on 0 would not do, since a
  // Submit stopped by validation counts an attempt and the old failure would
  // return.
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
