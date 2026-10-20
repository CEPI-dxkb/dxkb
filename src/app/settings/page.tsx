"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { PasswordChangeForm } from "@/components/settings/password-change-form";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";

import { getProfile } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/provider";
import type { UserProfile } from "@/lib/auth/types";
import { formatUserFacingErrorMessage } from "@/lib/utils";

export default function SettingsPage() {
  const { user, isSessionUnverified } = useAuth();
  const router = useRouter();
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
  const profileRetry = useRetryKeepingError({
    error,
    isFetching,
    // The root layout's `getCurrentUser()` asks the same profile service for
    // the `<AuthBoundary>` user, and a client refetch does not reach it, so a
    // Retry that loads the profile re-renders the server components (as the
    // outage banner's Retry does) to verify the session again.
    refetch: async () => {
      const result = await refetch();
      if (isSessionUnverified && result.isSuccess) router.refresh();
    },
  });

  // A Retry keeps the failure up ("Retrying…") instead of going back to the
  // skeletons until it answers.
  if (isLoading && !profileRetry.error) {
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
                profileRetry.error,
                user?.sessionUnverifiedReason ??
                  "The profile service returned no profile.",
              )}
            </p>
            <QueryRetryButton
              retrying={profileRetry.retrying}
              onRetry={profileRetry.retry}
            />
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
