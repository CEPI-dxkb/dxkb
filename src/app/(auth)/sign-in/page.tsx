"use client";

import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthActions } from "@/lib/auth/provider";
import { safePostAuthDestination } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { RequiredFormLabel } from "@/components/forms/required-form-components";

const formSchema = z.object({
  username: z.string().min(1, {
    error: "Username is required",
  }),
  password: z.string().min(1, {
    error: "Password is required",
  }),
});

function SigninForm() {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuthActions();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
    validators: { onChange: formSchema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        const destination = safePostAuthDestination(redirectTo);
        await signIn(value);
        toast.success("Logged in successfully. Welcome to DXKB!", {
          closeButton: true,
        });
        window.location.replace(destination);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Invalid username or password",
        );
      }
    },
  });

  return (
    <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="mb-2 space-y-1">
          <CardTitle className="text-center text-2xl font-bold">
            Sign in to DXKB
          </CardTitle>
          <CardDescription className="text-center">
            Enter your DXKB credentials to access your workspace
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

            <form.Field name="username">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Username or email</RequiredFormLabel>
                  <div className="relative">
                    <User className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter your username or email"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      onBlur={field.handleBlur}
                      className="pl-10"
                    />
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <FieldItem>
                  <div className="flex items-center justify-between">
                    <RequiredFormLabel>Password</RequiredFormLabel>
                    <p className="text-xs text-primary">
                      <Link
                        href="/forgot-password"
                        className="transition-colors duration-300 hover:font-medium hover:text-secondary"
                      >
                        Forgot your password?
                      </Link>
                    </p>
                  </div>
                  <div className="relative">
                    <Lock className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      onBlur={field.handleBlur}
                      className="px-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => {
                        setShowPassword(!showPassword);
                      }}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <Button
              type="submit"
              className="w-full transition-colors duration-200"
              disabled={form.state.isSubmitting}
            >
              {form.state.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-primary transition-colors duration-300 hover:font-medium hover:text-secondary"
              >
                Sign up on DXKB
              </Link>
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              <span className="font-bold">Note: </span>
              You may use your DXKB or BV-BRC username or email to sign in to
              this resource if you already had an account on one of those
              resources. While we are merging these resources together, you may
              sign in at those sites directly as well.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SigninPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <Card className="w-full max-w-md">
            <CardHeader className="mb-2 space-y-1">
              <CardTitle className="text-center text-2xl font-bold">
                Sign in to DXKB
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
      <SigninForm />
    </Suspense>
  );
}
