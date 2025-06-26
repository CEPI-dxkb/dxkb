"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { AuthUser, LoginCredentials } from "../app/api/auth/types";
import { AuthStorage } from "../app/api/auth/storage";
import { AuthService } from "../app/api/auth/service";

interface AuthContextType {
  user: AuthUser | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authService = new AuthService();

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = AuthStorage.load();
    if (savedUser) {
      // Validate token on app start
      authService.validateToken(savedUser.token).then((isValid) => {
        if (isValid) {
          setUser(savedUser);
        } else {
          AuthStorage.clear();
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!user?.token || !user?.expiresAt) return;

    const timeUntilExpiry = user.expiresAt - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0); // Refresh 5 mins before expiry

    const timeoutId = setTimeout(() => {
      refreshAuth();
    }, refreshTime);

    return () => clearTimeout(timeoutId);
  }, [user]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);
      try {
        const userData = await authService.login(credentials);
        setUser(userData);
        AuthStorage.save(userData);
      } catch (error) {
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [authService],
  );

  const logout = useCallback(async () => {
    setUser(null);
    AuthStorage.clear();

    // Optionally call logout endpoint
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout endpoint errors
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!user?.token) return;

    try {
      const newToken = await authService.refreshToken(user.token);
      const updatedUser = {
        ...user,
        token: newToken,
        expiresAt: Date.now() + 3600 * 1000, // Assume 1 hour expiry
      };
      setUser(updatedUser);
      AuthStorage.save(updatedUser);
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout(); // Force logout if refresh fails
    }
  }, [user, authService, logout]);

  const value = {
    user,
    login,
    logout,
    refreshAuth,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
