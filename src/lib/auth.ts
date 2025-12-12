import { cookies } from "next/headers";

/**
 * Authentication utilities for both client and server contexts
 */

// ============================================================================
// Client & Server Shared Utilities
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

// ============================================================================
// Server-Side Only Utilities
// ============================================================================

/**
 * Get server-side auth token from cookies
 * @returns The decoded authentication token or undefined if not found
 */
export async function getServerAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("token")?.value;
  return rawToken ? safeDecodeURIComponent(rawToken) : undefined;
}

/**
 * Server-side authenticated fetch for API routes
 * Automatically includes authentication token from cookies
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns The fetch response
 * @throws Error if not authenticated
 */
export async function serverAuthenticatedFetch(
  url: string,
  options: RequestInit = {},
) {
  const token = await getServerAuthToken();

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

