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

import { useAuthActions } from "@/lib/auth/provider";
import { formatPrefixedErrorMessage } from "@/lib/utils";
import {
  passwordFormSchema,
  type PasswordFormData,
} from "@/lib/forms/settings/settings-form-utils";

export function PasswordChangeForm() {
  const { changePassword } = useAuthActions();

  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    } satisfies PasswordFormData,
    onSubmit: async ({ value }) => {
      try {
        await changePassword(value.currentPassword, value.newPassword);
        toast.success("Password changed successfully.");
        form.reset();
      } catch (error) {
        toast.error(
          formatPrefixedErrorMessage("Failed to change password", error),
        );
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
        <CardDescription>Update your account password.</CardDescription>
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
          <form.Field name="currentPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel htmlFor={field.name}>
                  Current Password
                </RequiredFormLabel>
                <PasswordInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                <RequiredFormLabel htmlFor={field.name}>
                  New Password
                </RequiredFormLabel>
                <PasswordInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
                <RequiredFormLabel htmlFor={field.name}>
                  Confirm New Password
                </RequiredFormLabel>
                <PasswordInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
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
