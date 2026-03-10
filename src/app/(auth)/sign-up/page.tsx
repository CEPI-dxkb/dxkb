"use client";

import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldItem,
  FieldLabel,
  FieldErrors,
} from "@/components/ui/tanstack-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LuEye,
  LuEyeOff,
  LuMail,
  LuLock,
  LuMessageCircle,
  LuUser,
} from "react-icons/lu";
import { Textarea } from "@/components/ui/textarea";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { RequiredFormLabel } from "@/components/forms/required-form-components";

const formSchema = z
  .object({
    first_name: z.string().min(2, {
      error: "First name is required",
    }),
    middle_name: z.string(),
    last_name: z.string().min(2, {
      error: "Last name is required",
    }),
    username: z.string().min(1, {
      error: "Username is required",
    }),
    email: z.email({
      error: "Invalid email address",
    }),
    affiliation: z.string(),
    organisms: z.string(),
    interests: z.string(),
    password: z.string().min(8, {
      error: "Password must be at least 8 characters long",
    }),
    password_repeat: z.string().min(8),
  })
  .refine((data) => data.password === data.password_repeat, {
    path: ["password_repeat"],
    error: "Passwords do not match",
  });

type FormValues = z.infer<typeof formSchema>;

function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const { signUp, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, redirectTo]);

  const form = useForm({
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      username: "",
      email: "",
      affiliation: "",
      organisms: "",
      interests: "",
      password: "",
      password_repeat: "",
    } as FormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: formSchema as any, onSubmit: formSchema as any },
    onSubmit: async ({ value }) => {
      try {
        await signUp(value as FormValues);
        toast.success("Account created successfully. Welcome to DXKB!", {
          closeButton: true,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Sign up failed. Please try again.",
        );
      }
    },
  });

  return (
    <div className="bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">
            Create an account
          </CardTitle>
          <CardDescription className="text-center">
            Enter your information to create your account
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

            <form.Field name="first_name">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>First name</RequiredFormLabel>
                  <div className="relative">
                    <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="John"
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

            <form.Field name="middle_name">
              {(field) => (
                <FieldItem>
                  <FieldLabel field={field}>Middle name</FieldLabel>
                  <div className="relative">
                    <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="James"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <form.Field name="last_name">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Last name</RequiredFormLabel>
                  <div className="relative">
                    <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="Doe"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <form.Field name="username">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Username</RequiredFormLabel>
                  <div className="relative">
                    <LuMail className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="john.doe"
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

            <form.Field name="email">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Email</RequiredFormLabel>
                  <div className="relative">
                    <LuMail className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="john.doe@example.com"
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

            <form.Field name="affiliation">
              {(field) => (
                <FieldItem>
                  <FieldLabel field={field}>Organization</FieldLabel>
                  <div className="relative">
                    <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="John Doe Inc."
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

            <form.Field name="organisms">
              {(field) => (
                <FieldItem>
                  <FieldLabel field={field}>Organisms</FieldLabel>
                  <div className="relative">
                    <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      placeholder="Enter organisms"
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

            <form.Field name="interests">
              {(field) => (
                <FieldItem>
                  <FieldLabel field={field}>Interests</FieldLabel>
                  <div className="relative">
                    <LuMessageCircle className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Textarea
                      placeholder="Enter interests"
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="max-h-32 pl-10"
                    />
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Password</RequiredFormLabel>
                  <div className="relative">
                    <LuLock className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter a password"
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

            <form.Field name="password_repeat">
              {(field) => (
                <FieldItem>
                  <RequiredFormLabel>Confirm password</RequiredFormLabel>
                  <div className="relative">
                    <LuLock className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      id={field.name}
                      name={field.name}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Enter a password"
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
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <LuEyeOff className="h-4 w-4" />
                      ) : (
                        <LuEye className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {showConfirmPassword
                          ? "Hide password"
                          : "Show password"}
                      </span>
                    </Button>
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>

            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-primary font-medium hover:underline"
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
        <div className="bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-center text-2xl font-bold">
                Create an account
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
      <SignupForm />
    </Suspense>
  );
}
