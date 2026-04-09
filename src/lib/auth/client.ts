"use client";

import type {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
  PasswordResetRequest,
} from "@/lib/auth/types";

// ============================================================================
// BV-BRC Auth Client (better-auth style API)
// ============================================================================

interface AuthResponse<T> {
  data: T | null;
  error: { message: string; status?: number } | null;
}

interface SignInResponse {
  user: AuthUser;
  session: { token: string; expiresAt: string };
}

interface SignUpResponse {
  user: AuthUser;
  session: { token: string; expiresAt: string };
}

interface SessionResponse {
  user: AuthUser | null;
  session: { expiresAt: string } | null;
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
): Promise<AuthResponse<SignInResponse>> {
  return authFetch<SignInResponse>(
    "/api/auth/sign-in/email",
    { method: "POST", body: JSON.stringify(credentials) },
    "Sign in failed",
  );
}

export async function signUpEmail(
  credentials: SignupCredentials,
): Promise<AuthResponse<SignUpResponse>> {
  return authFetch<SignUpResponse>(
    "/api/auth/sign-up/email",
    { method: "POST", body: JSON.stringify(credentials) },
    "Sign up failed",
  );
}

export async function signOut(): Promise<AuthResponse<{ success: boolean }>> {
  return authFetch<{ success: boolean }>(
    "/api/auth/sign-out",
    { method: "POST" },
    "Sign out failed",
  );
}

export async function requestPasswordReset(
  data: PasswordResetRequest,
): Promise<AuthResponse<{ success: boolean; message: string }>> {
  return authFetch<{ success: boolean; message: string }>(
    "/api/auth/forget-password",
    { method: "POST", body: JSON.stringify(data) },
    "Password reset request failed",
  );
}

export async function sendVerificationEmail(): Promise<AuthResponse<{ success: boolean; message: string }>> {
  return authFetch<{ success: boolean; message: string }>(
    "/api/auth/send-verification-email",
    { method: "POST" },
    "Failed to send verification email",
  );
}

export async function getSessionWithUser(): Promise<AuthResponse<SessionResponse>> {
  return authFetch<SessionResponse>(
    "/api/auth/get-session",
    { method: "GET" },
    "Failed to get session",
  );
}

// ============================================================================
// Combined Auth Client Export (better-auth style)
// ============================================================================

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
