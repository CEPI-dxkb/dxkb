"use client";

import { createAuthClient } from "better-auth/react";
import type {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
  PasswordResetRequest,
} from "@/app/api/auth/types";

// ============================================================================
// Better Auth Client (for session management)
// ============================================================================

const authClient = createAuthClient({});

// ============================================================================
// BV-BRC Auth Client (better-auth style API)
// ============================================================================

interface AuthResponse<T> {
  data: T | null;
  error: { message: string; status?: number } | null;
}

// Raw API response types (expiresAt is ISO string over the wire)
interface SignInResponseRaw {
  user: AuthUser;
  session: { token: string; expiresAt: string };
}

interface SignUpResponseRaw {
  user: AuthUser;
  session: { token: string; expiresAt: string };
}

interface SessionResponseRaw {
  user: AuthUser | null;
  session: { expiresAt: string } | null;
}

// Public types (expiresAt parsed to Date for consumers)
interface SignInResponse {
  user: AuthUser;
  session: { token: string; expiresAt: Date };
}

interface SignUpResponse {
  user: AuthUser;
  session: { token: string; expiresAt: Date };
}

interface SessionResponse {
  user: AuthUser | null;
  session: { expiresAt: Date } | null;
}


export interface FetchOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: { message: string; status?: number }) => void;
}

async function authFetch<T>(
  url: string,
  init: RequestInit,
  fallbackError: string,
): Promise<AuthResponse<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = {
        message: (errorData as { message?: string })?.message || fallbackError,
        status: response.status,
      };
      return { data: null, error };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    const error = { message: err instanceof Error ? err.message : fallbackError };
    return { data: null, error };
  }
}

export async function signInEmail(
  credentials: SigninCredentials,
  options?: FetchOptions,
): Promise<AuthResponse<SignInResponse>> {
  const result = await authFetch<SignInResponseRaw>(
    "/api/auth/sign-in/email",
    { method: "POST", body: JSON.stringify(credentials) },
    "Sign in failed",
  );
  if (result.error) {
    options?.onError?.(result.error);
    return { data: null, error: result.error };
  }
  if (result.data) {
    const data: SignInResponse = {
      ...result.data,
      session: {
        ...result.data.session,
        expiresAt: new Date(result.data.session.expiresAt),
      },
    };
    options?.onSuccess?.(data);
    return { data, error: null };
  }
  return { data: null, error: null };
}

export async function signUpEmail(
  credentials: SignupCredentials,
  options?: FetchOptions,
): Promise<AuthResponse<SignUpResponse>> {
  const result = await authFetch<SignUpResponseRaw>(
    "/api/auth/sign-up/email",
    { method: "POST", body: JSON.stringify(credentials) },
    "Sign up failed",
  );
  if (result.error) {
    options?.onError?.(result.error);
    return { data: null, error: result.error };
  }
  if (result.data) {
    const data: SignUpResponse = {
      ...result.data,
      session: {
        ...result.data.session,
        expiresAt: new Date(result.data.session.expiresAt),
      },
    };
    options?.onSuccess?.(data);
    return { data, error: null };
  }
  return { data: null, error: null };
}

export async function signOut(
  options?: FetchOptions,
): Promise<AuthResponse<{ success: boolean }>> {
  const result = await authFetch<{ success: boolean }>(
    "/api/auth/sign-out",
    { method: "POST" },
    "Sign out failed",
  );
  if (result.error) options?.onError?.(result.error);
  else if (result.data) options?.onSuccess?.(result.data);
  return result;
}

export async function requestPasswordReset(
  data: PasswordResetRequest,
  options?: FetchOptions,
): Promise<AuthResponse<{ success: boolean; message: string }>> {
  const result = await authFetch<{ success: boolean; message: string }>(
    "/api/auth/forget-password",
    { method: "POST", body: JSON.stringify(data) },
    "Password reset request failed",
  );
  if (result.error) options?.onError?.(result.error);
  else if (result.data) options?.onSuccess?.(result.data);
  return result;
}

export async function sendVerificationEmail(
  options?: FetchOptions,
): Promise<AuthResponse<{ success: boolean; message: string }>> {
  const result = await authFetch<{ success: boolean; message: string }>(
    "/api/auth/send-verification-email",
    { method: "POST" },
    "Failed to send verification email",
  );
  if (result.error) options?.onError?.(result.error);
  else if (result.data) options?.onSuccess?.(result.data);
  return result;
}

export async function getSessionWithUser(
  options?: FetchOptions,
): Promise<AuthResponse<SessionResponse>> {
  const result = await authFetch<SessionResponseRaw>(
    "/api/auth/get-session",
    { method: "GET" },
    "Failed to get session",
  );
  if (result.error) {
    options?.onError?.(result.error);
    return { data: null, error: result.error };
  }
  if (result.data) {
    const data: SessionResponse = {
      ...result.data,
      session: result.data.session
        ? {
            ...result.data.session,
            expiresAt: new Date(result.data.session.expiresAt),
          }
        : null,
    };
    options?.onSuccess?.(data);
    return { data, error: null };
  }
  return { data: null, error: null };
}

// ============================================================================
// Combined Auth Client Export (better-auth style)
// ============================================================================

/**
 * Combined auth client following better-auth patterns
 * Usage:
 *   const { data, error } = await bvbrcAuth.signIn.email({ username, password })
 *   const { data, error } = await bvbrcAuth.signUp.email({ ... })
 *   const { data, error } = await bvbrcAuth.signOut()
 */
export const bvbrcAuth = {
  signIn: {
    email: signInEmail,
  },
  signUp: {
    email: signUpEmail,
  },
  signOut,
  requestPasswordReset,
  sendVerificationEmail,
  getSession: getSessionWithUser,
};
