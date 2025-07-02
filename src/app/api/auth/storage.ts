import { AuthUser, UserProfile } from "./types";

export const AUTH_STORAGE_KEY = "auth";
export const TOKEN_STORAGE_KEY = "token";
export const USERID_STORAGE_KEY = "user_id";
export const USER_PROFILE_STORAGE_KEY = "user_profile";
export const REALM_STORAGE_KEY = "realm";

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
  static save(user: AuthUser): void {
    if (typeof window !== "undefined") {
      // Extract realm from token if not already present
      const realm = user.realm || extractRealmFromToken(user.token);

      const userData = JSON.stringify({
        ...user,
        realm,
      });

      localStorage.setItem(AUTH_STORAGE_KEY, userData);
      localStorage.setItem(TOKEN_STORAGE_KEY, user.token);
      localStorage.setItem(USERID_STORAGE_KEY, user.username);
      if (realm) {
        localStorage.setItem(REALM_STORAGE_KEY, realm);
      }
    }
  }

  static saveUserProfile(userProfile: UserProfile): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
    }
  }

  static load(): AuthUser | null {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        try {
          const user = JSON.parse(saved);
          // Check if token is expired
          if (user.expires_at && Date.now() > user.expires_at) {
            this.clear();
            return null;
          }
          return user;
        } catch {
          this.clear();
        }
      }
    }
    return null;
  }

  static clear(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USERID_STORAGE_KEY);
      localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
      localStorage.removeItem(REALM_STORAGE_KEY);
    }
  }
}
