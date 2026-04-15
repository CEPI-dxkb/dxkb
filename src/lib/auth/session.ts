import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeDecode } from "@/lib/url";

// Cookie configuration for BV-BRC authentication
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export const sessionMaxAge = 3600 * 4; // 4 hours

// ============================================================================
// Token utilities
// ============================================================================

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
  userProfile?: { id?: string },
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
  } else {
    cookieStore.set("bvbrc_realm", "", { ...cookieOptions, maxAge: 0 });
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
    "bvbrc_su_original_token",
    "bvbrc_su_original_user_id",
    "bvbrc_su_original_realm",
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
  const token = rawToken ? safeDecode(rawToken) : undefined;
  const userId = cookieStore.get("bvbrc_user_id")?.value;
  const realm = cookieStore.get("bvbrc_realm")?.value;

  return { token, userId, realm };
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("bvbrc_token")?.value;
  return rawToken ? safeDecode(rawToken) : undefined;
}

// ============================================================================
// Auth guard helpers (return early 401 when session is missing)
// ============================================================================

export async function requireAuth(): Promise<
  { token: string; userId: string; realm?: string } | NextResponse
> {
  const { token, userId, realm } = await getSession();
  if (!token || !userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  return { token, userId, realm };
}

export async function requireAuthToken(): Promise<string | NextResponse> {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  return token;
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

// ============================================================================
// SU (Super User) backup cookie helpers
// ============================================================================

export const suSessionMaxAge = sessionMaxAge;

const suBackupCookieNames = [
  "bvbrc_su_original_token",
  "bvbrc_su_original_user_id",
  "bvbrc_su_original_realm",
] as const;

export async function createSuBackup(
  token: string,
  userId: string,
  realm?: string,
) {
  const cookieStore = await cookies();

  cookieStore.set("bvbrc_su_original_token", token, {
    ...cookieOptions,
    maxAge: suSessionMaxAge,
  });

  cookieStore.set("bvbrc_su_original_user_id", userId, {
    ...cookieOptions,
    maxAge: suSessionMaxAge,
  });

  if (realm) {
    cookieStore.set("bvbrc_su_original_realm", realm, {
      ...cookieOptions,
      maxAge: suSessionMaxAge,
    });
  } else {
    cookieStore.set("bvbrc_su_original_realm", "", {
      ...cookieOptions,
      maxAge: 0,
    });
  }
}

export async function getSuBackup() {
  const cookieStore = await cookies();

  return {
    token: cookieStore.get("bvbrc_su_original_token")?.value,
    userId: cookieStore.get("bvbrc_su_original_user_id")?.value,
    realm: cookieStore.get("bvbrc_su_original_realm")?.value,
  };
}

export async function deleteSuBackup() {
  const cookieStore = await cookies();

  for (const name of suBackupCookieNames) {
    cookieStore.set(name, "", { ...cookieOptions, maxAge: 0 });
  }
}

export async function restoreSuBackup() {
  const backup = await getSuBackup();

  if (backup.token && backup.userId) {
    await createSession(backup.token, backup.userId, backup.realm);
    await deleteSuBackup();
  }

  return backup;
}
