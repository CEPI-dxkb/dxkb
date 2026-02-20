"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
} from "../app/api/auth/types";
import { bvbrcAuth } from "../lib/auth-client";

interface AuthContextType {
  user: AuthUser | null;
  signIn: (credentials: SigninCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (credentials: SignupCredentials) => Promise<void>;
  refreshAuth: () => Promise<void>;
  requestPasswordReset: (usernameOrEmail: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: AuthUser | null;
}

export function AuthProvider({
  children,
  initialUser = null,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(
    initialUser?.email_verified ?? false,
  );

  /**
   * Fetch current session from the server using better-auth style endpoint
   */
  const fetchSession = useCallback(async (): Promise<AuthUser | null> => {
    const { data, error } = await bvbrcAuth.getSession();
    if (error || !data?.user) {
      return null;
    }
    return data.user;
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = await fetchSession();
        if (savedUser) {
          setUser(savedUser);
          setIsVerified(savedUser.email_verified ?? false);
        } else {
          setUser(null);
          setIsVerified(false);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        setUser(null);
        setIsVerified(false);
      }
    };

    initAuth();
  }, [fetchSession]);

  // Auto-refresh auth status periodically to sync with server-side session
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(
      async () => {
        try {
          const userData = await fetchSession();
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
  }, [user, fetchSession]);

  /**
   * Sign in with username and password (better-auth style)
   */
  const signIn = useCallback(async (credentials: SigninCredentials) => {
    setIsLoading(true);
    try {
      const result = await bvbrcAuth.signIn.email(credentials);

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (result.data?.user) {
        setUser(result.data.user);
        setIsVerified(result.data.user.email_verified ?? false);
      } else {
        const userData = await fetchSession();
        if (userData) {
          setUser(userData);
          setIsVerified(userData.email_verified ?? false);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchSession]);

  /**
   * Sign up with user details (better-auth style)
   */
  const signUp = useCallback(async (credentials: SignupCredentials) => {
    setIsLoading(true);
    try {
      const { error } = await bvbrcAuth.signUp.email(credentials);

      if (error) {
        throw new Error(error.message);
      }

      // Fetch full user data after successful sign up
      const userData = await fetchSession();
      if (userData) {
        setUser(userData);
        setIsVerified(userData.email_verified ?? false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchSession]);

  /**
   * Sign out (better-auth style)
   */
  const signOutHandler = useCallback(async () => {
    setUser(null);
    setIsVerified(false);

    try {
      await bvbrcAuth.signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }, []);

  /**
   * Request password reset (better-auth style)
   */
  const requestPasswordReset = useCallback(async (usernameOrEmail: string) => {
    setIsLoading(true);
    try {
      const { error } = await bvbrcAuth.requestPasswordReset({ usernameOrEmail });
      if (error) throw new Error(error.message || "Password reset request failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Send verification email (better-auth style)
   */
  const sendVerificationEmail = useCallback(async () => {
    try {
      const { error } = await bvbrcAuth.sendVerificationEmail();
      if (error) {
        console.error("Failed to send verification email:", error.message);
      }
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }
  }, []);

  /**
   * Refresh auth status from server
   */
  const refreshAuth = useCallback(async () => {
    try {
      const userData = await fetchSession();
      if (userData) {
        setUser(userData);
        setIsVerified(userData.email_verified ?? false);
      } else {
        await signOutHandler();
      }
    } catch (error) {
      console.error("Auth refresh failed:", error);
      await signOutHandler();
    }
  }, [fetchSession, signOutHandler]);

  const value = useMemo(() => ({
    user,
    signIn,
    signOut: signOutHandler,
    signUp,
    refreshAuth,
    requestPasswordReset,
    sendVerificationEmail,
    isLoading,
    isAuthenticated: !!user,
    isVerified,
  }), [
    user,
    signIn,
    signOutHandler,
    signUp,
    refreshAuth,
    requestPasswordReset,
    sendVerificationEmail,
    isLoading,
    isVerified,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
