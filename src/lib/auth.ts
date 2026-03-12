import { cookies } from "next/headers";

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
