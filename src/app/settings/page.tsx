"use client";

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { PasswordChangeForm } from "@/components/settings/password-change-form";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import type { UserProfile } from "@/lib/auth/types";

export default function SettingsPage() {
  const authenticatedFetch = useAuthenticatedFetch();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await authenticatedFetch("/api/auth/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });

  if (isLoading || !profile) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-[480px] w-full rounded-xl" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
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
