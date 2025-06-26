import { AuthUser, LoginCredentials } from "./types";

export class AuthService {
  private baseUrl =
    process.env.NEXT_PUBLIC_USER_SERVICE_URL ||
    "https://user.patricbrc.org";

  async login(credentials: LoginCredentials): Promise<AuthUser> {
    try {
      // Use your NextJS API route to avoid CORS issues
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Authentication failed");
      }

      const data = await response.json();

      return {
        username: credentials.username,
        email: data.email || `${credentials.username}@patricbrc.org`,
        token: data.token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at
          ? Date.now() + data.expires_at * 1000
          : undefined,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Login failed");
    }
  }

  async refreshToken(token: string): Promise<string> {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      throw new Error("Token refresh failed");
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/validate", {
        method: "POST",
        headers: {
          Authorization: token,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
