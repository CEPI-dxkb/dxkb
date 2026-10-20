"use client";

import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { PasswordChangeForm } from "@/components/settings/password-change-form";

import { getProfile } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/provider";
import type { UserProfile } from "@/lib/auth/types";
import { formatUserFacingErrorMessage } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    data: profile,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: getProfile,
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-120 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  // A failed refetch keeps the profile already loaded, so only a profile that
  // never arrived replaces the forms. The reason is this request's error, or
  // why the server could not verify the session (the same profile service).
  if (!profile) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-bold">User Settings</h1>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load your profile</AlertTitle>
          <AlertDescription>
            <p>
              {formatUserFacingErrorMessage(
                error,
                user?.sessionUnverifiedReason ??
                  "The profile service returned no profile.",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => {
                void refetch();
              }}
            >
              {isFetching && (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">User Settings</h1>
      <ProfileForm profile={profile} />
      <PreferencesForm profile={profile} />
      <PasswordChangeForm />
    </div>
  );
}
