"use client";

import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LuMail, LuArrowLeft } from "react-icons/lu";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { RequiredFormLabel } from "@/components/forms/required-form-components";

const formSchema = z.object({
  usernameOrEmail: z.string().min(1, {
    error: "Username or email is required",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { requestPasswordReset, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  // Get redirect URL from query params (for protected route redirects)
  const redirectTo = "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, redirectTo]);

  const form = useForm({
    defaultValues: {
      usernameOrEmail: "",
    } as FormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: formSchema as any, onSubmit: formSchema as any },
    onSubmit: async ({ value }) => {
      setError(""); // Clear any previous errors

      try {
        await requestPasswordReset((value as FormValues).usernameOrEmail);
        setSuccess(true);
      } catch (_err) {
        setError("An unexpected error occurred. Please try again.");
      }
    },
  });

  if (success) {
    return (
      <div className="bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl font-bold">
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
              <LuArrowLeft className="h-4 w-4" data-icon="inline-start" />
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">
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
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form.Field name="usernameOrEmail">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Username or email</RequiredFormLabel>
                  <div className="relative">
                    <LuMail className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="Enter your username or email"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="pl-10"
                    />
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <Button
              type="submit"
              className="text-muted-foreground hover:text-foreground w-full transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>

            <div className="text-center text-sm">
              <Link
                href="/sign-in"
                className="group text-primary hover:text-secondary font-medium transition-all duration-300 hover:font-medium"
              >
                <LuArrowLeft className="mr-1 inline h-3 w-3" />
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
