"use client";

import { useAuth } from "@/contexts/auth-context";
import { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireAuth?: boolean;
  showWhenLoading?: boolean;
}

export function AuthGuard({
  children,
  fallback = null,
  requireAuth = true,
  showWhenLoading = false,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state if specified
  if (isLoading && !showWhenLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  // Show children when auth requirement is met
  if (requireAuth && isAuthenticated) {
    return <>{children}</>;
  }

  if (!requireAuth && !isAuthenticated) {
    return <>{children}</>;
  }

  // Show fallback when auth requirement is not met
  return <>{fallback}</>;
}

// Convenience components for common patterns
export function AuthenticatedOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <AuthGuard requireAuth={true} fallback={fallback}>
      {children}
    </AuthGuard>
  );
}

export function UnauthenticatedOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <AuthGuard requireAuth={false} fallback={fallback}>
      {children}
    </AuthGuard>
  );
}
