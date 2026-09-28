"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOutAndRedirect } from "@/app/(auth)/redirect-action";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LogOut, Loader2 } from "lucide-react";

interface SignoutButtonProps {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "menu-item";
  size?: "default" | "sm" | "lg" | "icon" | "menu-item";
  showIcon?: boolean;
  confirmDialog?: boolean;
  className?: string;
  redirectTo?: string;
}

export function SignoutButton({
  variant = "outline",
  size = "default",
  showIcon = true,
  confirmDialog = true,
  className = "",
  redirectTo = "/",
}: SignoutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const queryClient = useQueryClient();
  const prepareSignOut = () => {
    setIsSigningOut(true);
    queryClient.clear();
  };

  const triggerChildren = (
    <>
      {isSigningOut ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        showIcon && <LogOut className="size-4" />
      )}
      {size !== "icon" && (
        <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
      )}
    </>
  );

  if (!confirmDialog) {
    return (
      <form action={signOutAndRedirect} onSubmit={prepareSignOut}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button
          type="submit"
          variant={variant}
          size={size}
          disabled={isSigningOut}
          className={className}
        >
          {triggerChildren}
        </Button>
      </form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }))}
            disabled={isSigningOut}
          >
            {triggerChildren}
          </button>
        )}
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of BV-BRC?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to sign in again to access your workspace and
            private data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form
            action={signOutAndRedirect}
            onSubmit={prepareSignOut}
          >
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <AlertDialogAction type="submit" disabled={isSigningOut}>
              {isSigningOut ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing out...
                </>
              ) : (
                "Sign Out"
              )}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
