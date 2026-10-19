"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudAlert, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionUnverifiedNotice } from "@/lib/auth/provider";

/**
 * Shown while the profile service cannot confirm the session (see
 * `AuthUser.sessionUnverified`), so an outage does not look like being signed
 * out. Retry re-renders the server components, which repeats the lookup.
 */
export function SessionUnverifiedBanner() {
  const { visible, reason, dismiss } = useSessionUnverifiedNotice();
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  const headingId = useId();

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-labelledby={headingId}
      className="flex items-center justify-center gap-2 bg-accent px-4 py-1.5 text-sm text-accent-foreground"
    >
      <CloudAlert className="size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong id={headingId}>We couldn&apos;t verify your account.</strong>{" "}
        {reason} You&apos;re still signed in, but some features may not work
        until the account service recovers.
      </p>
      <Button
        variant="outline-accent"
        size="xs"
        className="ml-1"
        disabled={isRetrying}
        onClick={() => {
          startRetry(() => {
            router.refresh();
          });
        }}
      >
        {isRetrying && (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        )}
        Retry
      </Button>
      <Button
        variant="outline-accent"
        size="icon-xs"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
