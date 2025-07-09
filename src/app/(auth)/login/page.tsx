"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { LuEye, LuEyeOff, LuLock, LuUser } from "react-icons/lu";
import { RequiredFormLabel } from "@/components/forms/required-form-label";

const formSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(8, { message: "Password is required" }),
});

function LoginForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, isAuthenticated } = useAuth();
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

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    console.log(data);
    try {
      await login(data);
      toast.success("Logged in successfully. Welcome to DXKB!", {closeButton: true});
      // Navigation will happen automatically via useEffect
    } catch (err) {
      console.log("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Invalid username or password",
      );
    }
  };

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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <RequiredFormLabel>Username or email</RequiredFormLabel>
                    <FormControl>
                      <div className="relative">
                        <LuUser className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
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
                    <FormControl>
                      <div className="relative">
                        <LuLock className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={field.value}
                          onChange={field.onChange}
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
                  href="/register"
                  className="text-primary hover:text-secondary font-medium transition-all duration-300 hover:font-medium"
                >
                  Register on DXKB
                </Link>
              </p>
              <p className="text-muted-foreground mt-6 text-xs">
                <span className="font-bold">Note: </span>
                You may use your DXKB or BV-BRC username or email to login to
                this resource if you already had an account on one of those
                resources. While we are merging these resources together, you
                may login at those sites directly as well.
              </p>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
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
    }>
      <LoginForm />
    </Suspense>
  );
}
