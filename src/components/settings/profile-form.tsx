"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { RequiredFormLabel } from "@/components/forms/required-form-components";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/contexts/auth-context";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import type { UserProfile } from "@/lib/auth/types";
import {
  profileFormSchema,
  buildProfilePatches,
  type ProfileFormData,
} from "@/lib/forms/settings/settings-form-utils";

interface ProfileFormProps {
  profile: UserProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { refreshAuth } = useAuth();
  const queryClient = useQueryClient();
  const authenticatedFetch = useAuthenticatedFetch();

  const form = useForm({
    defaultValues: {
      email: profile.email,
      first_name: profile.first_name,
      middle_name: profile.middle_name ?? "",
      last_name: profile.last_name,
      affiliation: profile.affiliation ?? "",
      organisms: profile.organisms ?? "",
      interests: profile.interests ?? "",
    } satisfies ProfileFormData,
    onSubmit: async ({ value }) => {
      const patches = buildProfilePatches(profile, value);

      if (patches.length === 0) {
        toast.info("No changes to save.");
        return;
      }

      try {
        const response = await authenticatedFetch("/api/auth/profile", {
          method: "POST",
          body: JSON.stringify(patches),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => null);
          toast.error(err?.message || "Failed to update profile.");
          return;
        }

        toast.success("Profile updated successfully.");
        await Promise.all([
          refreshAuth(),
          queryClient.invalidateQueries({ queryKey: ["user-profile"] }),
        ]);
      } catch {
        toast.error("Failed to update profile.");
      }
    },
    validators: {
      onSubmit: profileFormSchema,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Information</CardTitle>
        <CardDescription>
          Update your personal information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="grid gap-4"
        >
          {/* Username (read-only) */}
          <FieldItem>
            <Label>Username</Label>
            <Input value={profile.id} disabled />
          </FieldItem>

          {/* Email */}
          <form.Field name="email">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>Email</RequiredFormLabel>
                <Input
                  id={field.name}
                  type="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* First Name */}
          <form.Field name="first_name">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>First Name</RequiredFormLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* Middle Name */}
          <form.Field name="middle_name">
            {(field) => (
              <FieldItem>
                <Label htmlFor={field.name}>Middle Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* Last Name */}
          <form.Field name="last_name">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>Last Name</RequiredFormLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* Organization */}
          <form.Field name="affiliation">
            {(field) => (
              <FieldItem>
                <Label htmlFor={field.name}>Organization</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* Organisms */}
          <form.Field name="organisms">
            {(field) => (
              <FieldItem>
                <Label htmlFor={field.name}>Organisms</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* Interests */}
          <form.Field name="interests">
            {(field) => (
              <FieldItem>
                <Label htmlFor={field.name}>Interests</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  rows={3}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} className="w-fit">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
