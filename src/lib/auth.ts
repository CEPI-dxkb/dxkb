import { cookies, headers } from "next/headers";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

/**
 * Better Auth configuration for stateless session management.
 * No database is required - sessions are stored in signed/encrypted cookies.
 *
 * BV-BRC authentication is integrated through custom sign-in/sign-up flows
 * that validate credentials against the BV-BRC API and create sessions.
 */
export const auth = betterAuth({
  // No database configuration = stateless mode
  session: {
    expiresIn: 60 * 60 * 4, // 4 hours (matches BV-BRC token expiry)
    updateAge: 60 * 60, // Refresh session every 1 hour
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 4, // 4 hours cache duration
      strategy: "jwt", // Use JWT strategy for stateless sessions
      refreshCache: true, // Enable stateless refresh
    },
  },
  account: {
    // For stateless mode without OAuth
    storeStateStrategy: "cookie",
    storeAccountCookie: true,
  },
  // Custom trustedOrigins for development
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3019",
  ],
  plugins: [
    // Enable automatic cookie handling in Next.js server actions
    // Must be the last plugin in the array
    nextCookies(),
  ],
});

/**
 * Get the current session from better-auth (server-side)
 * Use this in RSC and server actions
 */
export async function getSession() {
  const headersList = await headers();
  return auth.api.getSession({
    headers: headersList,
  });
}

// ============================================================================
// BV-BRC Authentication Utilities
// ============================================================================

/**
 * Safe URL decoding utility - can be used in both client and server contexts
 * Prevents errors from malformed encoded strings
 */
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn("Failed to decode cookie value:", error);
    return value; // Return original value if decoding fails
  }
}

/**
 * Get BV-BRC auth token from cookies
 * This token is needed for BV-BRC API calls
 * @returns The decoded BV-BRC authentication token or undefined if not found
 */
export async function getBvbrcAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("bvbrc_token")?.value;
  return rawToken ? safeDecodeURIComponent(rawToken) : undefined;
}

/**
 * Server-side authenticated fetch for BV-BRC API routes
 * Automatically includes BV-BRC authentication token from cookies
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns The fetch response
 * @throws Error if not authenticated
 */
export async function serverAuthenticatedFetch(
  url: string,
  options: RequestInit = {},
) {
  const token = await getBvbrcAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const headers = {
    ...options.headers,
    Authorization: token,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
