import { AuthUser } from "./types";

const AUTH_STORAGE_KEY = "brc_auth_user";

export class AuthStorage {
  static save(user: AuthUser): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
  }

  static load(): AuthUser | null {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        try {
          const user = JSON.parse(saved);
          // Check if token is expired
          if (user.expiresAt && Date.now() > user.expiresAt) {
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
    }
  }
}
