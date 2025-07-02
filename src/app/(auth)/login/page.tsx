"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!credentials.username.trim() || !credentials.password) {
      setError("Please enter both username and password");
      return;
    }

    try {
      console.log("LOGIN");
      await login(credentials);
      // Navigation will happen automatically via useEffect
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid username or password",
      );
    }
  };

  const handleInputChange =
    (field: "username" | "password") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials((prev) => ({ ...prev, [field]: e.target.value }));
      // Clear error when user starts typing
      if (error) setError("");
    };

  return (
    <div className="bg-background flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 mb-2">
          <CardTitle className="text-center text-2xl font-bold">
            Sign in to DXKB
          </CardTitle>
          <CardDescription className="text-center">
            Enter your DXKB credentials to access your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={credentials.username}
                onChange={handleInputChange("username")}
                placeholder="Enter your username"
                required
                disabled={isLoading}
                autoComplete="username"
                className="transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>

                <p className="text-primary text-xs">
                  <Link
                    href="/forgot-password"
                    className="hover:text-secondary hover:font-medium transition-all duration-300"
                  >
                    Forgot your password?
                  </Link>
                </p>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={handleInputChange("password")}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 transform text-gray-500 transition-colors hover:text-gray-700"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <Alert
                variant="destructive"
                className="animate-in slide-in-from-top-1"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full transition-all duration-200 text-muted-foreground hover:text-foreground"
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
              Don't have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:text-secondary hover:font-medium transition-all duration-300"
              >
                Register on DXKB
              </Link>
            </p>
            <p className="mt-6 text-muted-foreground text-xs">
              <span className="font-bold">Note: </span>
              You may use your DXKB or BV-BRC username or email to login to this
              resource if you already had an account on one of those resources.
              While we are merging these resources together, you may login at
              those sites directly as well.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
