import { AuthUser, LoginCredentials, RegisterCredentials } from "./types";

export class AuthService {
  private baseUrl =
    process.env.NEXT_PUBLIC_USER_SERVICE_URL || "https://user.patricbrc.org";

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

      // TODO: reformat this returned data to match BV-BRC
      const data = await response.json();
      console.log("DATA (service.ts): ", data);

      return {
        username: credentials.username,
        email: data.email || `${credentials.username}@patricbrc.org`,
        token: data.token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at
          ? Date.now() + data.expires_at * 1000
          : undefined,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Login failed");
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthUser> {
    try {
      // Use your NextJS API route to avoid CORS issues
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      console.log("REGISTER RESPONSE", response);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      // TODO: reformat this returned data to match BV-BRC
      const data = await response.json();
      console.log("DATA (service.ts): ", data);

      return {
        username: credentials.username,
        email: data.email || `${credentials.username}@patricbrc.org`,
        token: data.token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at
          ? Date.now() + data.expires_at * 1000
          : undefined,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Registration failed",
      );
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

  async validateAndGetUserInfo(
    token: string,
    username: string,
  ): Promise<{ isValid: boolean; userInfo?: any }> {
    try {
      const response = await fetch(
        `/api/auth/user_info?username=${encodeURIComponent(username)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: token,
          },
        },
      );

      if (response.ok) {
        const userInfo = await response.json();
        return { isValid: true, userInfo };
      } else {
        return { isValid: false };
      }
    } catch (error) {
      return { isValid: false };
    }
  }
}
