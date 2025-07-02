"use client";

import { useAuth } from "@/contexts/auth-context";
import { useAuthStyles } from "@/hooks/use-auth-styles";
import { AuthGuard, AuthenticatedOnly, UnauthenticatedOnly } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AuthExample() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const { authClass, authClasses, whenAuthenticated, whenUnauthenticated } = useAuthStyles();

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <h2 className="text-2xl font-bold">Authentication Examples</h2>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Authentication Examples</h2>

      {/* Example 1: Simple conditional rendering */}
      <Card>
        <CardHeader>
          <CardTitle>1. Simple Conditional Rendering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAuthenticated ? (
            <div className="p-4 bg-green-100 rounded-lg">
              <p className="text-green-800">Welcome, {user?.username}!</p>
              <Button onClick={logout} variant="outline" size="sm" className="mt-2">
                Logout
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-blue-100 rounded-lg">
              <p className="text-blue-800">Please log in to continue</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Example 2: Using AuthGuard component */}
      <Card>
        <CardHeader>
          <CardTitle>2. Using AuthGuard Component</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthGuard requireAuth={true} fallback={<p className="text-red-600">This content requires authentication</p>}>
            <div className="p-4 bg-green-100 rounded-lg">
              <p className="text-green-800">Protected content - you are authenticated!</p>
            </div>
          </AuthGuard>

          <AuthGuard requireAuth={false} fallback={<p className="text-blue-600">You are already logged in</p>}>
            <div className="p-4 bg-yellow-100 rounded-lg">
              <p className="text-yellow-800">Public content - please log in</p>
            </div>
          </AuthGuard>
        </CardContent>
      </Card>

      {/* Example 3: Using convenience components */}
      <Card>
        <CardHeader>
          <CardTitle>3. Convenience Components</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthenticatedOnly fallback={<p className="text-red-600">Login required</p>}>
            <div className="p-4 bg-green-100 rounded-lg">
              <p className="text-green-800">AuthenticatedOnly component</p>
            </div>
          </AuthenticatedOnly>

          <UnauthenticatedOnly fallback={<p className="text-blue-600">Already logged in</p>}>
            <div className="p-4 bg-yellow-100 rounded-lg">
              <p className="text-yellow-800">UnauthenticatedOnly component</p>
            </div>
          </UnauthenticatedOnly>
        </CardContent>
      </Card>

      {/* Example 4: Using useAuthStyles hook */}
      <Card>
        <CardHeader>
          <CardTitle>4. Conditional Styling with useAuthStyles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn(
            "p-4 rounded-lg transition-colors duration-200",
            authClass("bg-green-100 text-green-800", "bg-blue-100 text-blue-800")
          )}>
            <p>Dynamic styling based on auth status</p>
          </div>

          <div className={cn(
            "p-4 rounded-lg border-2 transition-all duration-200",
            authClasses({
              "border-green-500 bg-green-50": isAuthenticated,
              "border-blue-500 bg-blue-50": !isAuthenticated,
              "opacity-75": false, // This won't be applied
            })
          )}>
            <p>Multiple conditional classes</p>
          </div>

          <div className={cn(
            "p-4 rounded-lg",
            whenAuthenticated("bg-green-100 text-green-800"),
            whenUnauthenticated("bg-blue-100 text-blue-800")
          )}>
            <p>Individual conditional classes</p>
          </div>
        </CardContent>
      </Card>

      {/* Example 5: Complex conditional rendering */}
      <Card>
        <CardHeader>
          <CardTitle>5. Complex Conditional Rendering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthGuard requireAuth={true} fallback={
            <div className="p-4 bg-red-100 rounded-lg">
              <p className="text-red-800 font-medium">Access Denied</p>
              <p className="text-red-600 text-sm">You need to be logged in to view this content.</p>
            </div>
          }>
            <div className="p-4 bg-green-100 rounded-lg">
              <p className="text-green-800 font-medium">Welcome to the Dashboard!</p>
              <div className="mt-2 space-y-1">
                <p className="text-green-700 text-sm">Username: {user?.username}</p>
                <p className="text-green-700 text-sm">Email: {user?.email}</p>
              </div>
              <div className="mt-4 space-x-2">
                <Button size="sm">View Profile</Button>
                <Button size="sm" variant="outline" onClick={logout}>Logout</Button>
              </div>
            </div>
          </AuthGuard>
        </CardContent>
      </Card>
    </div>
    
  );
} 