"use client";

import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { Mail, ArrowLeft } from "lucide-react";
import { useAuthActions } from "@/lib/auth/provider";
import { RequiredFormLabel } from "@/components/forms/required-form-components";

const formSchema = z.object({
  usernameOrEmail: z.string().min(1, {
    error: "Username or email is required",
  }),
});

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestPasswordReset } = useAuthActions();

  const form = useForm({
    defaultValues: {
      usernameOrEmail: "",
    },
    validators: { onChange: formSchema },
    onSubmit: async ({ value }) => {
      setError("");
      setIsSubmitting(true);
      await requestPasswordReset(value.usernameOrEmail)
        .then(
          () => {
            setSuccess(true);
          },
          () => {
            setError("An unexpected error occurred. Please try again.");
          },
        )
        .finally(() => {
          setIsSubmitting(false);
        });
    },
  });

  if (success) {
    return (
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle variant="page" className="text-center">
              Check your email
            </CardTitle>
            <CardDescription className="text-center">
              We&apos;ve sent a password reset link to your email address if it
              exists in our system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                If you don&apos;t see the email, check your spam folder or try
                again.
              </AlertDescription>
            </Alert>
            <Link
              href="/sign-in"
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              <ArrowLeft className="size-4" data-icon="inline-start" />
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle variant="page" className="text-center">
            Forgot password?
          </CardTitle>
          <CardDescription className="text-center">
            Enter your username or email address and we&apos;ll send you a link
            to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form.Field name="usernameOrEmail">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Username or email</RequiredFormLabel>
                  <InputGroup>
                    <InputGroupInput
                      placeholder="Enter your username or email"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      onBlur={field.handleBlur}
                    />
                    <InputGroupAddon align="inline-start">
                      <Mail />
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>

            <div className="text-center text-sm">
              <Link
                href="/sign-in"
                className="group font-medium text-primary transition-colors duration-300 hover:font-medium hover:text-secondary"
              >
                <ArrowLeft className="mr-1 inline size-3" />
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
