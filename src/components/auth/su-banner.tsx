"use client";

import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks";
import { authAdmin } from "@/lib/auth/advanced";
import { toast } from "sonner";

export function SuBanner() {
  const { isImpersonating, user } = useAuth();
  const suExit = async () => {
    const { data, error } = await authAdmin.impersonate.exit();
    if (error) {
      toast.error("Failed to exit impersonation");
      return;
    }
    if (data) toast.success("Returned to your account");
  };

  if (!isImpersonating) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span>
        You are impersonating{" "}
        <strong>{user?.username}</strong>.
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-1 h-6 border-accent-foreground/30 bg-transparent px-2 text-xs hover:bg-accent-foreground/10"
        onClick={() => suExit()}
      >
        Exit SU
      </Button>
    </div>
  );
}
