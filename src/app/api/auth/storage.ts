import { AuthUser, UserProfile } from "./types";

// Utility function to extract realm from token
export function extractRealmFromToken(token: string): string | undefined {
  // Look for the pattern "un=username@realm" in the token
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

export class AuthStorage {
  // User profile is now fetched via API when needed, but keep localStorage for UI preferences
  static saveUserProfile(userProfile: UserProfile): void {
    if (typeof window !== "undefined") {
      // Only store non-sensitive UI preferences locally
      const uiPreferences = {
        theme: (userProfile as any).theme,
        language: (userProfile as any).language,
        // Add other non-sensitive UI state here
      };
      localStorage.setItem("ui_preferences", JSON.stringify(uiPreferences));
    }
  }

  // Check authentication status via API
  static async load(): Promise<AuthUser | null> {
    try {
      const response = await fetch("/api/auth/verify-tokens", {
        method: "GET",
        credentials: "include", // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated && data.user) {
          return {
            username: data.user.username,
            email: data.user.email,
            token: "", // Token is in HTTP-only cookie, not accessible to client
            realm: data.user.realm,
            expires_at: 0, // Managed server-side
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            email_verified: data.user.email_verified,
            id: data.user.id,
          } as AuthUser;
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to verify authentication:", error);
      return null;
    }
  }

  // Clear authentication cookies via API
  static async clear(): Promise<boolean> {
    try {
      // Clear server-side cookies
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to clear auth cookies:", error);
      return false;
    }
  }
}
