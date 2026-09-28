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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { safePostAuthDestination } from "@/lib/auth/redirect";
import { AlertCircle, Loader2 } from "lucide-react";
import { SignupPasswordFields, SignupProfileFields } from "./sign-up-fields";
import { useSignupForm } from "./use-signup-form";

function SignupForm() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useAuthActions();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const form = useSignupForm(async (value) => {
    setIsSubmitting(true);
    setError("");
    await signUp(value)
      .then(() => {
        toast.success("Account created successfully. Welcome to DXKB!", {
          closeButton: true,
        });
        window.location.replace(safePostAuthDestination(redirectTo));
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Sign up failed. Please try again.",
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
          <form
            action={() => {
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

export default function SignupPage() {
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
