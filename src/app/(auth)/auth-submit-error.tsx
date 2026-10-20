"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * A failed auth submit, brought to where the user is: on mount it scrolls
 * into view and takes focus. The alert sits at the top of the form, which on
 * the tall sign-up form is off screen once the user has scrolled down to the
 * submit button, and that button was disabled while the request ran, which
 * drops focus to `<body>`. Without both, a failure looks like the form reset.
 *
 * Give it a `key` that changes per attempt, so a second failure with the same
 * text remounts it and is brought into view again.
 */
export function AuthSubmitError({ message }: { message: string }) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alert = alertRef.current;
    if (!alert) return;
    alert.scrollIntoView({ block: "center" });
    alert.focus({ preventScroll: true });
  }, []);

  return (
    <Alert ref={alertRef} variant="destructive" tabIndex={-1}>
      <AlertCircle className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
