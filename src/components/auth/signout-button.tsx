"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
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
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
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
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignout = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push(redirectTo);
    } catch (error) {
      console.error("Signout error:", error);
      // Even if signout fails, redirect to signin
      router.push(redirectTo);
    } finally {
      // Ensure any temporary pointer-events lock is cleared even on errors.
      setTimeout(() => (document.body.style.pointerEvents = ""), 0);
      setIsSigningOut(false);
    }
  };

  const triggerChildren = (
    <>
      {isSigningOut ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        showIcon && <LogOut className="h-4 w-4" />
      )}
      {size !== "icon" && (
        <span>
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </span>
      )}
    </>
  );

  if (!confirmDialog) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={isSigningOut}
        className={className}
        onClick={handleSignout}
      >
        {triggerChildren}
      </Button>
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
            You&apos;ll need to sign in again to access your workspace and private
            data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSignout} disabled={isSigningOut}>
            {isSigningOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              "Sign Out"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
