"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { RequiredFormLabel } from "@/components/forms/required-form-components";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import {
  passwordFieldsSchema,
  passwordFormSchema,
  type PasswordFormData,
} from "@/lib/forms/settings/settings-form-utils";

export function PasswordChangeForm() {
  const authenticatedFetch = useAuthenticatedFetch();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    } satisfies PasswordFormData,
    onSubmit: async ({ value }) => {
      const parsed = passwordFormSchema.safeParse(value);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message;
        toast.error(firstError || "Please fix the form errors.");
        return;
      }

      const response = await authenticatedFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        toast.error(err.message || "Failed to change password.");
        return;
      }

      toast.success("Password changed successfully.");
      form.reset();
    },
    validators: {
      onSubmit: passwordFieldsSchema,
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
          {/* Current Password */}
          <form.Field name="currentPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>Current Password</RequiredFormLabel>
                <div className="relative">
                  <Input
                    id={field.name}
                    type={showCurrent ? "text" : "password"}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrent(!showCurrent)}
                    aria-label={showCurrent ? "Hide current password" : "Show current password"}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* New Password */}
          <form.Field name="newPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>New Password</RequiredFormLabel>
                <div className="relative">
                  <Input
                    id={field.name}
                    type={showNew ? "text" : "password"}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNew(!showNew)}
                    aria-label={showNew ? "Hide new password" : "Show new password"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>

          {/* Confirm New Password */}
          <form.Field name="confirmPassword">
            {(field) => (
              <FieldItem>
                <RequiredFormLabel>Confirm New Password</RequiredFormLabel>
                <div className="relative">
                  <Input
                    id={field.name}
                    type={showConfirm ? "text" : "password"}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
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
