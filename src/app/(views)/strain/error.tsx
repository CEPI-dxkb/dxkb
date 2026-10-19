"use client";

import { Button } from "@/components/ui/button";

interface StrainErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  // Refreshes the route and then resets. reset() alone re-renders the same
  // failed server payload, so the button could never recover.
  retry: () => void;
}

export default function StrainError({ error, retry }: StrainErrorProps) {
  return (
    <div
      className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-6"
      role="alert"
    >
      <h1 className="text-lg font-semibold">Strain view could not be loaded</h1>
      <p className="my-2 text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
