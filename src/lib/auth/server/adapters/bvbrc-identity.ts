import { getRequiredEnv } from "@/lib/env";
import type { Result, AuthErrorCode } from "@/lib/auth/port";
import type {
  SigninCredentials,
  SignupCredentials,
  UserProfile,
} from "@/lib/auth/types";
import { ok, fail, networkFailure } from "../result";
import type { IdentityProviderPort } from "../ports";

async function parseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  return body.message || fallback;
}

async function authenticate(
  credentials: SigninCredentials,
): Promise<Result<{ token: string }>> {
  try {
    const authUrl = getRequiredEnv("USER_AUTH_URL");
    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const isAuthFailure = response.status === 401 || response.status === 403;
      return isAuthFailure
        ? fail("invalid_credentials", "Invalid credentials", 401)
        : fail(
            "service_unavailable",
            "Authentication service unavailable",
            503,
          );
    }

    const body = await response.text();
    const rawToken = response.headers.get("Authorization") ?? body ?? "";
    const token = rawToken.trim();
    if (!token) {
      return fail(
        "service_unavailable",
        "Authentication service unavailable",
        503,
      );
    }

    return ok({ token });
  } catch (cause) {
    return { data: null, error: networkFailure(cause, "Sign in failed") };
  }
}

async function signUp(
  input: SignupCredentials,
): Promise<Result<{ token: string }>> {
  try {
    const registerUrl = getRequiredEnv("USER_REGISTER_URL");
    const response = await fetch(registerUrl, {
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
    });

    if (!response.ok) {
      const body = await response.text();
      let message = "Registration failed";
      try {
        const parsed = JSON.parse(body) as { message?: string };
        message = parsed.message || message;
      } catch {
        message = body || message;
      }
      return fail("validation", message, response.status);
    }

    const body = await response.text();
    const rawToken = response.headers.get("Authorization") ?? body ?? "";
    const token = rawToken.trim();
    if (!token) {
      return fail(
        "service_unavailable",
        "Registration failed: missing auth token",
        502,
      );
    }

    return ok({ token });
  } catch (cause) {
    return {
      data: null,
      error: networkFailure(cause, "Registration service unavailable"),
    };
  }
}

async function impersonate(
  actingUserId: string,
  targetUser: string,
  password: string,
): Promise<Result<{ token: string }>> {
  try {
    const authUrl = getRequiredEnv("USER_AUTH_URL");
    const response = await fetch(`${authUrl}/sulogin`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        targetUser,
        password,
        username: actingUserId,
      }),
    });

    if (!response.ok) {
      return fail("invalid_credentials", "Invalid credentials", 401);
    }

    const token = (await response.text()).trim();
    if (!token) {
      return fail("invalid_credentials", "Invalid credentials", 401);
    }

    return ok({ token });
  } catch (cause) {
    return {
      data: null,
      error: networkFailure(cause, "Authentication service unavailable"),
    };
  }
}

async function validateToken(
  userId: string,
  token: string,
): Promise<Result<UserProfile>> {
  try {
    const response = await fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: token,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const code: AuthErrorCode =
        response.status === 401 ? "unauthorized" : "service_unavailable";
      return fail(code, "Token validation failed", response.status);
    }

    const profile = (await response.json()) as UserProfile;
    return ok(profile);
  } catch (cause) {
    return {
      data: null,
      error: networkFailure(cause, "Token validation failed"),
    };
  }
}

async function fetchProfile(
  userId: string,
  token?: string,
): Promise<UserProfile | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = token;

  try {
    const response = await fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(userId)}`,
      { headers },
    );

    if (response.ok) return (await response.json()) as UserProfile;
    console.warn(
      `Failed to fetch user profile for ${userId}:`,
      response.status,
    );
    return null;
  } catch (error) {
    console.warn("Failed to fetch user profile:", error);
    return null;
  }
}

const bvbrcPasswordResetUrl = "https://user.bv-brc.org/reset";

async function requestPasswordReset(
  usernameOrEmail: string,
): Promise<Result<void>> {
  try {
    const response = await fetch(bvbrcPasswordResetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: usernameOrEmail }),
    });

    if (!response.ok) {
      return fail(
        "service_unavailable",
        await parseErrorMessage(response, "Failed to send password reset email"),
        response.status,
      );
    }
    return ok(undefined);
  } catch (cause) {
    return {
      data: null,
      error: networkFailure(cause, "Password reset service unavailable"),
    };
  }
}

async function sendVerificationEmail(
  userId: string,
  token: string,
): Promise<Result<void>> {
  try {
    const response = await fetch(getRequiredEnv("USER_VERIFICATION_URL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ id: userId }),
    });

    if (!response.ok) {
      return fail(
        "service_unavailable",
        await parseErrorMessage(response, "Failed to send verification email"),
        response.status,
      );
    }
    return ok(undefined);
  } catch (cause) {
    return {
      data: null,
      error: networkFailure(cause, "Internal server error"),
    };
  }
}

async function verifyEmailToken(
  verificationToken: string,
  username: string,
): Promise<Result<void>> {
  const timeoutMs = 15_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getRequiredEnv("USER_VERIFICATION_URL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token: verificationToken, username }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return fail(
        "validation",
        await parseErrorMessage(response, "Email verification failed"),
        response.status,
      );
    }

    await response.json().catch(() => undefined);
    return ok(undefined);
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      return fail(
        "service_unavailable",
        "Email verification request timed out",
        504,
      );
    }
    return {
      data: null,
      error: networkFailure(
        cause,
        "Internal server error during email verification",
      ),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function changePassword(
  userId: string,
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<Result<void>> {
  try {
    const response = await fetch(`${getRequiredEnv("USER_URL")}/`, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      return fail(
        "validation",
        errorText || "Failed to change password",
        response.status,
      );
    }

    const result = (await response.json()) as { error?: { message?: string } };
    if (result.error) {
      return fail(
        "validation",
        result.error.message || "Failed to change password",
        400,
      );
    }
    return ok(undefined);
  } catch (cause) {
    return {
      data: null,
      error: networkFailure(cause, "Internal server error"),
    };
  }
}

export function bvbrcIdentity(): IdentityProviderPort {
  return {
    authenticate,
    signUp,
    impersonate,
    validateToken,
    fetchProfile,
    requestPasswordReset,
    sendVerificationEmail,
    verifyEmailToken,
    changePassword,
  };
}
