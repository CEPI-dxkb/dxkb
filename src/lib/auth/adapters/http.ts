"use client";

import type {
  AuthPort,
  AuthError,
  AuthErrorCode,
  Result,
} from "@/lib/auth/port";
import type {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
} from "@/lib/auth/types";

interface SessionEnvelope {
  user: AuthUser | null;
  session: { token: string; expiresAt: string } | null;
}

function codeFromStatus(status: number): AuthErrorCode {
  if (status === 400) return "validation";
  if (status === 401) return "invalid_credentials";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 503) return "service_unavailable";
  return "unknown";
}

async function errorFromResponse(
  response: Response,
  fallback: string,
): Promise<AuthError> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return {
    message: body.message ?? fallback,
    code: codeFromStatus(response.status),
    status: response.status,
  };
}

function networkError(cause: unknown, fallback: string): AuthError {
  return {
    message: cause instanceof Error ? cause.message : fallback,
    code: "network",
  };
}

async function postJson<T>(
  url: string,
  body: unknown,
  fallback: string,
): Promise<Result<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      return { data: null, error: await errorFromResponse(response, fallback) };
    }

    const text = await response.text();
    const data = (text ? JSON.parse(text) : undefined) as T;
    return { data, error: null };
  } catch (cause) {
    return { data: null, error: networkError(cause, fallback) };
  }
}

async function getJson<T>(url: string, fallback: string): Promise<Result<T>> {
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      return { data: null, error: await errorFromResponse(response, fallback) };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (cause) {
    return { data: null, error: networkError(cause, fallback) };
  }
}

function unwrapUser(
  result: Result<SessionEnvelope>,
  fallback: string,
): Result<AuthUser> {
  if (result.error) return result;
  if (!result.data?.user) {
    return { data: null, error: { message: fallback, code: "unknown" } };
  }
  return { data: result.data.user, error: null };
}

export function httpAuthAdapter(): AuthPort {
  return {
    async getSession() {
      const result = await getJson<SessionEnvelope>(
        "/api/auth/get-session",
        "Failed to get session",
      );
      if (result.error) return result;
      return { data: result.data.user, error: null };
    },

    async signIn(credentials: SigninCredentials) {
      return unwrapUser(
        await postJson<SessionEnvelope>(
          "/api/auth/sign-in/email",
          credentials,
          "Sign in failed",
        ),
        "Sign in failed",
      );
    },

    async signUp(input: SignupCredentials) {
      return unwrapUser(
        await postJson<SessionEnvelope>(
          "/api/auth/sign-up/email",
          input,
          "Sign up failed",
        ),
        "Sign up failed",
      );
    },

    async signOut() {
      const result = await postJson<unknown>(
        "/api/auth/sign-out",
        undefined,
        "Sign out failed",
      );
      if (result.error) return result;
      return { data: undefined, error: null };
    },

    async impersonate(targetUser: string, password: string) {
      return unwrapUser(
        await postJson<SessionEnvelope>(
          "/api/auth/su-login",
          { targetUser, password },
          "Impersonation failed",
        ),
        "Impersonation failed",
      );
    },

    async exitImpersonation() {
      return unwrapUser(
        await postJson<SessionEnvelope>(
          "/api/auth/su-exit",
          undefined,
          "Failed to exit impersonation",
        ),
        "Failed to exit impersonation",
      );
    },

    async requestPasswordReset(usernameOrEmail: string) {
      const result = await postJson<unknown>(
        "/api/auth/forget-password",
        { usernameOrEmail },
        "Password reset request failed",
      );
      if (result.error) return result;
      return { data: undefined, error: null };
    },

    async sendVerificationEmail() {
      const result = await postJson<unknown>(
        "/api/auth/send-verification-email",
        undefined,
        "Failed to send verification email",
      );
      if (result.error) return result;
      return { data: undefined, error: null };
    },

    request(input, init) {
      return fetch(input, { ...init, credentials: "include" });
    },
  };
}
