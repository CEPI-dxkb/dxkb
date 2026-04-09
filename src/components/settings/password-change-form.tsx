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
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { RequiredFormLabel } from "@/components/forms/required-form-components";
import { PasswordInput } from "@/components/settings/password-input";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import {
  passwordFormSchema,
  type PasswordFormData,
} from "@/lib/forms/settings/settings-form-utils";

export function PasswordChangeForm() {
  const authenticatedFetch = useAuthenticatedFetch();

  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    } satisfies PasswordFormData,
    onSubmit: async ({ value }) => {
      try {
        const response = await authenticatedFetch("/api/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            currentPassword: value.currentPassword,
            newPassword: value.newPassword,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => null);
          toast.error(err?.message || "Failed to change password.");
          return;
        }

        toast.success("Password changed successfully.");
        form.reset();
      } catch {
        toast.error("Failed to change password.");
      }
    },
    validators: {
      onSubmit: passwordFormSchema,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update your account password.
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
          <form.Field name="currentPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>Current Password</RequiredFormLabel>
                <PasswordInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  label="current password"
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          <form.Field name="newPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>New Password</RequiredFormLabel>
                <PasswordInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  label="new password"
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>Confirm New Password</RequiredFormLabel>
                <PasswordInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  label="confirm password"
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting} className="w-fit">
                {isSubmitting ? "Changing..." : "Change Password"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
