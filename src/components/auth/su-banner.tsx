"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useExitImpersonation } from "@/lib/auth/provider";

export function SuBanner() {
  const { isImpersonating, user } = useAuth();
  const exitImpersonation = useExitImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
      <ShieldAlert className="size-4 shrink-0" />
      <span>
        You are impersonating <strong>{user?.username}</strong>.
      </span>
      <Button
        variant="outline-accent"
        size="xs"
        className="ml-1"
        onClick={() => void exitImpersonation()}
      >
        Exit SU
      </Button>
    </div>
  );
}
