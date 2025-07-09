"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
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

interface LogoutButtonProps {
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

export function LogoutButton({
  variant = "outline",
  size = "default",
  showIcon = true,
  confirmDialog = true,
  className = "",
  redirectTo = "/",
}: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Without the timeout, the body will not have 'pointer-events: none' applied to the redirect
      setTimeout(() => (document.body.style.pointerEvents = ""), 0)
      router.push(redirectTo);
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, redirect to login
      router.push(redirectTo);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const LogoutButtonContent = (
    <Button
      variant={variant}
      size={size}
      disabled={isLoggingOut}
      className={className}
    >
      {isLoggingOut ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        showIcon && <LogOut className="h-4 w-4" />
      )}
      {size !== "icon" && (
        <span>
          {isLoggingOut ? "Signing out..." : "Sign Out"}
        </span>
      )}
    </Button>
  );

  if (!confirmDialog) {
    return <div onClick={handleLogout}>{LogoutButtonContent}</div>;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{LogoutButtonContent}</AlertDialogTrigger>
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
          <AlertDialogAction onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? (
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
