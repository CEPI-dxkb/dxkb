import { getRequiredEnv } from "@/lib/env";
import type {
  AuthErrorCode,
  Result,
  SigninCredentials,
  SignupCredentials,
  UpstreamProfilePatch,
  UserProfile,
} from "@/lib/auth/types";
import { fail, networkFailure, ok } from "../result";

// Cloudflare rejects Node's default user-agent for BV-BRC API requests.
const serverUserAgent = "curl/8.7.1 DXKB-V2/1.0";
const requestTimeoutMs = 15_000;

function joinUrl(base: string, path = ""): string {
  return path
    ? `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
    : base;
}

async function request(
  input: string,
  init: RequestInit,
  fallback: string,
): Promise<Result<Response>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", serverUserAgent);
    const response = await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const body = response.body ? await response.arrayBuffer() : null;
    return ok(
      new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      return fail("service_unavailable", `${fallback} timed out`, 504);
    }
    return { data: null, error: networkFailure(cause, fallback) };
  } finally {
    clearTimeout(timeout);
  }
}

function codeForStatus(status: number): AuthErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "service_unavailable";
  if (status >= 400) return "validation";
  return "unknown";
}

function httpFailure<T>(
  response: Response,
  fallback: string,
  authFailureCode?: "unauthorized" | "invalid_credentials",
): Result<T> {
  const code =
    authFailureCode && (response.status === 401 || response.status === 403)
      ? authFailureCode
      : codeForStatus(response.status);
  return fail(code, fallback, response.status);
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === "string" &&
    profile.id.length > 0 &&
    typeof profile.email === "string" &&
    typeof profile.email_verified === "boolean" &&
    typeof profile.first_name === "string" &&
    typeof profile.last_name === "string" &&
    typeof profile.l_id === "string" &&
    typeof profile.creation_date === "string" &&
    typeof profile.last_login === "string" &&
    typeof profile.organisms === "string" &&
    typeof profile.reverification === "boolean" &&
    typeof profile.source === "string"
  );
}

async function readToken(
  response: Response,
  fallback: string,
): Promise<Result<{ token: string }>> {
  const headerToken = response.headers.get("Authorization")?.trim();
  const token = headerToken || (await response.text()).trim();
  return token ? ok({ token }) : fail("service_unavailable", fallback, 502);
}

export async function authenticate(
  credentials: SigninCredentials,
): Promise<Result<{ token: string }>> {
  const result = await request(
    getRequiredEnv("USER_AUTH_URL"),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: credentials.username,
        password: credentials.password,
      }),
    },
    "Authentication service unavailable",
  );
  if (result.error) return result;
  if (!result.data.ok) {
    return httpFailure(
      result.data,
      "Authentication failed",
      "invalid_credentials",
    );
  }
  return readToken(result.data, "Authentication service returned no token");
}

export async function registerUser(
  input: SignupCredentials,
): Promise<Result<{ token: string }>> {
  const result = await request(
    getRequiredEnv("USER_REGISTER_URL"),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        first_name: input.first_name || "",
        middle_name: input.middle_name || "",
        last_name: input.last_name || "",
        username: input.username,
        email: input.email,
        affiliation: input.affiliation || "",
        organisms: input.organisms || "",
        interests: input.interests || "",
        password: input.password,
        password_repeat: input.password_repeat,
      }),
    },
    "Registration service unavailable",
  );
  if (result.error) return result;
  if (!result.data.ok) return httpFailure(result.data, "Registration failed");
  return readToken(result.data, "Registration service returned no token");
}

export async function impersonateUser(
  actingUserId: string,
  targetUser: string,
  password: string,
): Promise<Result<{ token: string }>> {
  const result = await request(
    joinUrl(getRequiredEnv("USER_AUTH_URL"), "sulogin"),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        targetUser,
        password,
        username: actingUserId,
      }),
    },
    "Authentication service unavailable",
  );
  if (result.error) return result;
  if (!result.data.ok) {
    return httpFailure(
      result.data,
      "Impersonation failed",
      "invalid_credentials",
    );
  }
  const token = (await result.data.text()).trim();
  return token
    ? ok({ token })
    : fail("invalid_credentials", "Impersonation returned no token", 401);
}

export async function getProfile(
  userId: string,
  token: string,
): Promise<Result<UserProfile>> {
  const result = await request(
    joinUrl(getRequiredEnv("USER_URL"), encodeURIComponent(userId)),
    { headers: { Accept: "application/json", Authorization: token } },
    "Profile service unavailable",
  );
  if (result.error) return result;
  if (!result.data.ok) {
    return httpFailure(result.data, "Profile lookup failed", "unauthorized");
  }
  const rawProfile: unknown = await result.data.json().catch(() => null);
  const profile =
    rawProfile && typeof rawProfile === "object"
      ? {
          ...rawProfile,
          creation_date:
            (rawProfile as Record<string, unknown>).creation_date ??
            (rawProfile as Record<string, unknown>).creationDate,
          last_login:
            (rawProfile as Record<string, unknown>).last_login ??
            (rawProfile as Record<string, unknown>).lastLogin,
        }
      : rawProfile;
  return isUserProfile(profile)
    ? ok(profile)
    : fail(
        "service_unavailable",
        "Profile service returned an invalid response",
        502,
      );
}

export async function updateProfile(
  userId: string,
  token: string,
  patches: UpstreamProfilePatch[],
): Promise<Result<void>> {
  const result = await request(
    joinUrl(getRequiredEnv("USER_URL"), encodeURIComponent(userId)),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
        Accept: "application/json",
        Authorization: token,
      },
      body: JSON.stringify(patches),
    },
    "Profile service unavailable",
  );
  if (result.error) return result;
  return result.data.ok
    ? ok(undefined)
    : httpFailure(result.data, "Failed to update profile", "unauthorized");
}

export async function requestPasswordReset(
  usernameOrEmail: string,
): Promise<Result<void>> {
  const result = await request(
    getRequiredEnv("USER_PASSWORD_RESET_URL"),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: usernameOrEmail }),
    },
    "Password reset service unavailable",
  );
  if (result.error) return result;
  return result.data.ok
    ? ok(undefined)
    : httpFailure(result.data, "Failed to send password reset email");
}

export async function sendVerificationEmail(
  userId: string,
  token: string,
): Promise<Result<void>> {
  const result = await request(
    getRequiredEnv("USER_VERIFICATION_URL"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ id: userId }),
    },
    "Verification service unavailable",
  );
  if (result.error) return result;
  return result.data.ok
    ? ok(undefined)
    : httpFailure(
        result.data,
        "Failed to send verification email",
        "unauthorized",
      );
}

export async function verifyEmailToken(
  verificationToken: string,
  username: string,
): Promise<Result<void>> {
  const result = await request(
    getRequiredEnv("USER_VERIFICATION_URL"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token: verificationToken, username }),
    },
    "Email verification service unavailable",
  );
  if (result.error) return result;
  if (result.data.ok) return ok(undefined);
  if (result.data.status >= 500 || result.data.status === 429) {
    return httpFailure(result.data, "Email verification failed");
  }
  return fail("validation", "Email verification failed", result.data.status);
}

export async function changePassword(
  userId: string,
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<Result<void>> {
  const result = await request(
    joinUrl(getRequiredEnv("USER_URL"), "/"),
    {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "setPassword",
        params: [userId, currentPassword, newPassword],
      }),
    },
    "Password service unavailable",
  );
  if (result.error) return result;
  if (!result.data.ok) {
    return httpFailure(
      result.data,
      "Failed to change password",
      "unauthorized",
    );
  }
  const body = (await result.data.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  if (body?.error) {
    return fail("validation", "Failed to change password", 400);
  }
  return ok(undefined);
}

export function extractRealmFromToken(token: string): string | undefined {
  const unMatch = token.match(/(?:^|\|)un=([^|]+)/);
  if (!unMatch) return undefined;
  const atIndex = unMatch[1].indexOf("@");
  return atIndex === -1 ? undefined : unMatch[1].slice(atIndex + 1);
}
