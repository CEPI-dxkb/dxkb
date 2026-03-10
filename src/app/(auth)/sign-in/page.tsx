"use client";

import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
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
import { LuEye, LuEyeOff, LuLock, LuUser } from "react-icons/lu";
import { RequiredFormLabel } from "@/components/forms/required-form-components";

const formSchema = z.object({
  username: z.string().min(1, {
    error: "Username is required",
  }),
  password: z.string().min(8, {
    error: "Password of at least 8 characters is required",
  }),
});

type FormValues = z.infer<typeof formSchema>;

function SigninForm() {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get redirect URL from query params (for protected route redirects)
  const redirectTo = searchParams.get("redirect") || "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, redirectTo]);

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    } as FormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: formSchema as any, onSubmit: formSchema as any },
    onSubmit: async ({ value }) => {
      try {
        await signIn(value as FormValues);
        toast.success("Logged in successfully. Welcome to DXKB!", {
          closeButton: true,
        });
        // Navigation will happen automatically via useEffect
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Invalid username or password",
        );
      }
    },
  });

  return (
    <div className="bg-background flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
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

            <form.Field name="username">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Username or email</RequiredFormLabel>
                  <div className="relative">
                    <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
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

            <form.Field name="password">
              {(field) => (
                <FieldItem>
                  <div className="flex items-center justify-between">
                    <RequiredFormLabel>Password</RequiredFormLabel>
                    <p className="text-primary text-xs">
                      <Link
                        href="/forgot-password"
                        className="hover:text-secondary transition-all duration-300 hover:font-medium"
                      >
                        Forgot your password?
                      </Link>
                    </p>
                  </div>
                  <div className="relative">
                    <LuLock className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="pr-10 pl-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <LuEyeOff className="h-4 w-4" />
                      ) : (
                        <LuEye className="h-4 w-4" />
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
              className="text-muted-foreground hover:text-foreground w-full transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-muted-foreground text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="text-primary hover:text-secondary font-medium transition-all duration-300 hover:font-medium"
              >
                Sign up on DXKB
              </Link>
            </p>
            <p className="text-muted-foreground mt-6 text-xs">
              <span className="font-bold">Note: </span>
              You may use your DXKB or BV-BRC username or email to sign in to
              this resource if you already had an account on one of those
              resources. While we are merging these resources together, you
              may sign in at those sites directly as well.
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
        <div className="bg-background flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
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
                <Loader2 className="h-6 w-6 animate-spin" />
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
