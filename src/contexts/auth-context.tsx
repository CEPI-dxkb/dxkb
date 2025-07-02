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
import { AuthService } from "../app/api/auth/service";

interface AuthContextType {
  user: AuthUser | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  refreshAuth: () => Promise<void>;
  validateUser: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const authService = new AuthService();

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = AuthStorage.load();
    if (savedUser) {
      // Validate token on app start
      authService
        .validateAndGetUserInfo(savedUser.token, savedUser.username)
        .then(({ isValid, userInfo }) => {
          if (isValid) {
            const updatedUser = userInfo
              ? { ...savedUser, ...userInfo }
              : savedUser;
            setUser(updatedUser);
            setIsVerified(userInfo?.email_verified ?? false);
            if (userInfo) {
              AuthStorage.save(updatedUser);
            }
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
    if (!user?.token || !user?.expires_at) return;

    const timeUntilExpiry = user.expires_at - Date.now();
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
        console.log("AUTH STORAGE SAVED", AuthStorage.load());

        // Validate user and fetch metadata after successful login
        const { isValid, userInfo } = await authService.validateAndGetUserInfo(
          userData.token,
          userData.username,
        );
        if (isValid && userInfo) {
          console.log("USER INFO", userInfo);
          // Update user with additional metadata
          const updatedUser = { ...userData, ...userInfo };
          setUser(updatedUser);
          setIsVerified(userInfo.email_verified);
          console.log("USER VERIFIED?", userInfo.email_verified);
          AuthStorage.save(updatedUser);
          AuthStorage.saveUserProfile(userInfo);
        } else {
          console.warn("Token validation failed or no user metadata available");
        }
      } catch (error) {
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [authService],
  );

  const register = useCallback(
    async (credentials: RegisterCredentials) => {
      setIsLoading(true);
      try {
        const userData = await authService.register(credentials);
        setUser(userData);
        AuthStorage.save(userData);

        // Fetch user metadata after successful registration
        const { isValid, userInfo } = await authService.validateAndGetUserInfo(
          userData.token,
          userData.username,
        );
        if (isValid && userInfo) {
          const updatedUser = { ...userData, ...userInfo };
          setUser(updatedUser);
          setIsVerified(userInfo.email_verified);
          AuthStorage.save(updatedUser);
        } else {
          console.warn("Token validation failed or no user metadata available");
        }
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

      // Validate and get fresh user metadata
      const { isValid, userInfo } = await authService.validateAndGetUserInfo(
        newToken,
        user.username,
      );
      if (isValid && userInfo) {
        const finalUser = { ...updatedUser, ...userInfo };
        setUser(finalUser);
        AuthStorage.save(finalUser);
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      await logout(); // Force logout if refresh fails
    }
  }, [user, authService, logout]);

  const validateUser = useCallback(async () => {
    console.log("VALIDATING USER");
    console.log("USER", user);
    if (!user?.token) {
      console.log("NO TOKEN");
      return;
    }
    console.log("VALIDATE USER TOKEN", user.token);
    const { isValid, userInfo } = await authService.validateAndGetUserInfo(
      user.token,
      user.username,
    );
    console.log("VALIDATE USER IS VALID", isValid);
    if (!isValid) {
      await logout();
    } else if (userInfo) {
      // Update user with fresh metadata
      const updatedUser = { ...user, ...userInfo };
      setUser(updatedUser);
      AuthStorage.save(updatedUser);
    }
  }, [user, authService, logout]);

  const value = {
    user,
    login,
    logout,
    register,
    refreshAuth,
    validateUser,
    isLoading,
    isAuthenticated: !!user,
    isVerified
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
