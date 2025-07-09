"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { LuMail, LuArrowLeft } from "react-icons/lu";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { RequiredFormLabel } from "@/components/forms/required-form-label";

const formSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(1, { message: "Username or email is required" }),
});

export default function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      usernameOrEmail: "",
    },
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { resetPassword, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  // Get redirect URL from query params (for protected route redirects)
  const redirectTo = "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, redirectTo]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setError(""); // Clear any previous errors

    try {
      await resetPassword(data.usernameOrEmail);
      setSuccess(true);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    }
  };

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
                If you don&apos;t see the email, check your spam folder or try again.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">
                <LuArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Link>
            </Button>
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
            Enter your username or email address and we&apos;ll send you a link to
            reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="usernameOrEmail"
                render={({ field }) => (
                  <FormItem>
                    <RequiredFormLabel>Username or email</RequiredFormLabel>
                    <FormControl>
                      <div className="relative">
                        <LuMail className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                        <Input
                          placeholder="Enter your username or email"
                          {...field}
                          className="pl-10"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  href="/login"
                  className="group text-primary hover:text-secondary font-medium transition-all duration-300 hover:font-medium"
                >
                  <LuArrowLeft className="mr-1 inline h-3 w-3" />
                  Back to login
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
