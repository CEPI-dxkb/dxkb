import { cookies } from "next/headers";

// Cookie configuration for BV-BRC authentication
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

const sessionMaxAge = 3600 * 4; // 4 hours

// ============================================================================
// Token utilities
// ============================================================================

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn("Failed to decode cookie value:", error);
    return value;
  }
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

// ============================================================================
// Session CRUD (Next.js auth convention)
// ============================================================================

export async function createSession(
  token: string,
  username: string,
  realm?: string,
  userProfile?: Record<string, unknown>,
) {
  const cookieStore = await cookies();

  cookieStore.set("bvbrc_token", token, {
    ...cookieOptions,
    maxAge: sessionMaxAge,
  });

  if (realm) {
    cookieStore.set("bvbrc_realm", realm, {
      ...cookieOptions,
      maxAge: sessionMaxAge,
    });
  }

  const userId = String(userProfile?.id ?? username.split("@")[0]);
  cookieStore.set("bvbrc_user_id", userId, {
    ...cookieOptions,
    maxAge: sessionMaxAge,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();

  const cookiesToClear = [
    "bvbrc_token",
    "bvbrc_realm",
    "bvbrc_user_profile",
    "bvbrc_user_id",
  ];

  for (const name of cookiesToClear) {
    cookieStore.set(name, "", {
      ...cookieOptions,
      maxAge: 0,
    });
  }
}

export async function getSession() {
  const cookieStore = await cookies();

  const rawToken = cookieStore.get("bvbrc_token")?.value;
  const token = rawToken ? safeDecodeURIComponent(rawToken) : undefined;
  const userId = cookieStore.get("bvbrc_user_id")?.value;
  const realm = cookieStore.get("bvbrc_realm")?.value;

  return { token, userId, realm };
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("bvbrc_token")?.value;
  return rawToken ? safeDecodeURIComponent(rawToken) : undefined;
}

// ============================================================================
// Server-side authenticated fetch
// ============================================================================

export async function serverAuthenticatedFetch(
  url: string,
  options: RequestInit = {},
) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const callerHeaders = new Headers(options.headers as HeadersInit);
  if (!callerHeaders.has("Content-Type")) {
    callerHeaders.set("Content-Type", "application/json");
  }
  callerHeaders.set("Authorization", token);
  const headers = Object.fromEntries(callerHeaders.entries());

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
