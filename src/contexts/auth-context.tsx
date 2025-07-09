"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import {
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from "../app/api/auth/types";
import { AuthStorage } from "../app/api/auth/storage";

interface AuthContextType {
  user: AuthUser | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  refreshAuth: () => Promise<void>;
  validateUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check authentication status via secure cookies
        const savedUser = await AuthStorage.load();
        if (savedUser) {
          setUser(savedUser);
          setIsVerified(savedUser.email_verified ?? false);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        await AuthStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Auto-refresh auth status periodically to sync with server-side session
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(
      async () => {
        try {
          const userData = await AuthStorage.load();
          if (userData) {
            setUser(userData);
            setIsVerified(userData.email_verified ?? false);
          } else {
            setUser(null);
            setIsVerified(false);
          }
        } catch (error) {
          console.error("Auth refresh failed:", error);
        }
      },
      5 * 60 * 1000,
    ); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
      }

      // Login sets cookies server-side, now fetch user data
      const userData = await AuthStorage.load();
      if (userData) {
        setUser(userData);
        setIsVerified(userData.email_verified ?? false);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      // Registration sets cookies server-side, now fetch user data
      const userData = await AuthStorage.load();
      if (userData) {
        setUser(userData);
        setIsVerified(userData.email_verified ?? false);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (usernameOrEmail: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail }),
      });

      if (!response.ok) {
        console.warn("Password reset request failed:", response.status);
      }
    } catch (error) {
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setIsVerified(false);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout API call failed:", error);
    }

    await AuthStorage.clear();
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const userData = await AuthStorage.load();
      if (userData) {
        setUser(userData);
        setIsVerified(userData.email_verified ?? false);
      } else {
        await logout();
      }
    } catch (error) {
      console.error("Auth refresh failed:", error);
      await logout();
    }
  }, [logout]);

  const sendVerificationEmail = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        console.log("Verification email sent successfully");
      } else {
        console.error("Failed to send verification email:", response.status);
      }
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }
  }, []);

  const validateUser = useCallback(async () => {
    try {
      const userData = await AuthStorage.load();
      if (userData) {
        setUser(userData);
        setIsVerified(userData.email_verified ?? false);
      } else {
        await logout();
      }
    } catch (error) {
      console.error("User validation failed:", error);
      await logout();
    }
  }, [logout]);

  const value = {
    user,
    login,
    logout,
    register,
    refreshAuth,
    validateUser,
    resetPassword,
    sendVerificationEmail,
    isLoading,
    isAuthenticated: !!user,
    isVerified,
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
