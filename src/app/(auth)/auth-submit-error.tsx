"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Scrolls into view and takes focus on mount; key it per attempt so a repeat
 * failure remounts it.
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
