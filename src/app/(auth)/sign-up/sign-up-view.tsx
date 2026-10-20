"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@/lib/auth/provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { safePostAuthDestination } from "@/lib/auth/redirect";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { AuthSubmitError } from "../auth-submit-error";
import { SignupPasswordFields, SignupProfileFields } from "./sign-up-fields";
import { useSignupForm } from "./use-signup-form";

function SignupForm() {
  const [error, setError] = useState("");
  // Keys the error alert, so every failed attempt brings it into view again.
  const [attempt, setAttempt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useAuthActions();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const form = useSignupForm(async (value) => {
    setIsSubmitting(true);
    setError("");
    setAttempt((count) => count + 1);
    await signUp(value)
      .then(() => {
        toast.success("Account created successfully. Welcome to DXKB!", {
          closeButton: true,
        });
        window.location.replace(safePostAuthDestination(redirectTo));
      })
      .catch((cause: unknown) => {
        setError(
          formatUserFacingErrorMessage(cause, "Sign up failed. Please try again."),
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  });

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle variant="page" className="text-center">
            Create an account
          </CardTitle>
          <CardDescription className="text-center">
            Enter your information to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            noValidate: the zod schema reports every empty field inline. A
            native `required` bubble would block the submit first and show
            a second, different message for one field only.
          */}
          <form
            noValidate
            action={() => {
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            {error && <AuthSubmitError key={attempt} message={error} />}

            <SignupProfileFields form={form} disabled={isSubmitting} />
            <SignupPasswordFields form={form} />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function SignupView() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="space-y-1">
              <CardTitle variant="page" className="text-center">
                Create an account
              </CardTitle>
              <CardDescription className="text-center">
                Loading...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
