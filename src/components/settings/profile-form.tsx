"use client";

import { useForm } from "@tanstack/react-form";
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

import { useAuthActions } from "@/lib/auth/provider";
import type { UserProfile } from "@/lib/auth/types";
import { formatPrefixedErrorMessage } from "@/lib/utils";
import {
  profileFormSchema,
  buildProfilePatches,
  type ProfileFormData,
} from "@/lib/forms/settings/settings-form-utils";

interface ProfileFormProps {
  profile: UserProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { updateProfile } = useAuthActions();

  const form = useForm({
    defaultValues: {
      email: profile.email,
      first_name: profile.first_name,
      middle_name: profile.middle_name ?? "",
      last_name: profile.last_name,
      affiliation: profile.affiliation ?? "",
      organisms: profile.organisms,
      interests: profile.interests ?? "",
    } satisfies ProfileFormData,
    onSubmit: async ({ value }) => {
      const patches = buildProfilePatches(profile, value);

      if (patches.length === 0) {
        toast.info("No changes to save.");
        return;
      }

      try {
        await updateProfile(patches);
        toast.success("Profile updated successfully.");
      } catch (error) {
        toast.error(formatPrefixedErrorMessage("Failed to update profile", error));
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
        <CardDescription>Update your personal information.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="grid gap-4"
        >
          {/* Username (read-only) */}
          <FieldItem>
            <Label htmlFor="profile-username">Username</Label>
            <Input id="profile-username" value={profile.id} disabled />
          </FieldItem>

          {/* Email */}
          <form.Field name="email">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel htmlFor={field.name}>
                  Email
                </RequiredFormLabel>
                <Input
                  id={field.name}
                  type="email"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                <RequiredFormLabel htmlFor={field.name}>
                  First Name
                </RequiredFormLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                <RequiredFormLabel htmlFor={field.name}>
                  Last Name
                </RequiredFormLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
