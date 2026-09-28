"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "@/lib/auth/provider";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SuLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuLoginDialog({ open, onOpenChange }: SuLoginDialogProps) {
  const [targetUser, setTargetUser] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startImpersonation } = useAuthActions();

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!targetUser.trim() || !password) return;

    setIsSubmitting(true);
    await startImpersonation(targetUser.trim(), password)
      .then(() => {
        onOpenChange(false);
        setTargetUser("");
        setPassword("");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "SU login failed");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTargetUser("");
      setPassword("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SU Login</DialogTitle>
          <DialogDescription className="sr-only">
            Impersonate another user account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <h3 className="text-center text-lg font-semibold">
            Impersonate User
          </h3>

          <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-bold text-warning italic">
                WARNING &mdash; With great power comes great responsibility...
              </p>
              <p className="mt-1 text-warning">
                You can take control of another user&apos;s account to
                troubleshoot or assist them. Please be careful and respectful of
                the user&apos;s account that you are controlling.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="su-target-user">User to Impersonate</Label>
              <Input
                id="su-target-user"
                placeholder="User id for other account"
                value={targetUser}
                onChange={(e) => {
                  setTargetUser(e.target.value);
                }}
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="su-password">Your Password</Label>
              <Input
                id="su-password"
                type="password"
                placeholder="Your admin password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting || !targetUser.trim() || !password}
              >
                {isSubmitting ? "Authenticating..." : "Take Control"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
