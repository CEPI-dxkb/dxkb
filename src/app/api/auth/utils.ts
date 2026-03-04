import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "@/lib/auth";
import { getRequiredEnv } from "@/lib/env";

// Cookie configuration for BV-BRC authentication
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

const SESSION_MAX_AGE = 3600 * 4; // 4 hours

// Helper function to fetch user profile metadata from BV-BRC
export async function getProfileMetadata(
  token: string,
  username: string,
): Promise<Record<string, unknown> | null> {
  try {
    const userResponse = await fetch(
      `${getRequiredEnv("USER_URL")}/${username}`,
      {
        headers: {
          Authorization: token,
          Accept: "application/json",
        },
      },
    );

    if (userResponse.ok) {
      return await userResponse.json();
    }

    console.warn(
      `Failed to fetch user profile for ${username}:`,
      userResponse.status,
    );
    return null;
  } catch (error) {
    console.warn("Failed to fetch user profile metadata:", error);
    return null;
  }
}

// Helper function to fetch user email by username for password reset
export async function getUserEmailByUsername(
  username: string,
): Promise<string | null> {
  try {
    const userResponse = await fetch(
      `${getRequiredEnv("USER_URL")}/${username}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (userResponse.ok) {
      const userData = await userResponse.json();
      return userData.email || null;
    }

    console.warn(
      `Failed to fetch user email for ${username}:`,
      userResponse.status,
    );
    return null;
  } catch (error) {
    console.warn("Failed to fetch user email by username:", error);
    return null;
  }
}

// Helper function to set BV-BRC authentication cookies
export async function setBvbrcAuthCookies(
  token: string,
  username: string,
  realm?: string,
  userProfile?: Record<string, unknown>,
) {
  const cookieStore = await cookies();

  // Set BV-BRC token cookie (renamed from 'token' to avoid conflicts with better-auth)
  cookieStore.set("bvbrc_token", token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });

  // Set realm if provided
  if (realm) {
    cookieStore.set("bvbrc_realm", realm, {
      ...COOKIE_OPTIONS,
      maxAge: SESSION_MAX_AGE,
    });
  }

  // Set only a stable user ID (no PII): local username for USER_URL paths and session (realm stored separately).
  // Use local part when falling back to username so USER_URL path and workspace principal (username@realm) stay correct.
  const userId = String(userProfile?.id ?? username.split("@")[0]);
  cookieStore.set("bvbrc_user_id", userId, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });
}

// Helper function to clear all BV-BRC authentication cookies
export async function clearBvbrcAuthCookies() {
  const cookieStore = await cookies();

  const cookiesToClear = [
    "bvbrc_token",
    "bvbrc_realm",
    "bvbrc_user_profile",
    "bvbrc_user_id",
    // Legacy cookie names (for cleanup during migration)
    "token",
    "auth",
    "refresh_token",
    "user_id",
    "realm",
    "user_profile",
  ];

  for (const name of cookiesToClear) {
    cookieStore.set(name, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  }
}

// Helper function to get BV-BRC auth data from cookies (ID only; fetch full profile server-side via getProfileMetadata when needed)
export async function getBvbrcAuthData() {
  const cookieStore = await cookies();

  const rawToken = cookieStore.get("bvbrc_token")?.value;
  const token = rawToken ? safeDecodeURIComponent(rawToken) : undefined;
  const userId = cookieStore.get("bvbrc_user_id")?.value;
  const realm = cookieStore.get("bvbrc_realm")?.value;

  return { token, userId, realm };
}

export function extractRealmFromToken(token: string): string | undefined {
  const unMatch = token.match(/un=([^|]+)/);
  if (unMatch) {
    const unValue = unMatch[1];
    const atIndex = unValue.indexOf("@");
    if (atIndex !== -1) {
      return unValue.substring(atIndex + 1);
    }
  }
  return undefined;
}

