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
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AuthUser, SigninCredentials, SignupCredentials } from "@/lib/auth/types";
import { bvbrcAuth } from "@/lib/auth/client";
import { isProtectedPagePath } from "@/lib/auth/routes";

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
  const [isLoading, setIsLoading] = useState(!initialUser);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchSession = useCallback(async (): Promise<AuthUser | null> => {
    const { data, error } = await bvbrcAuth.getSession();
    if (error || !data?.user) {
      return null;
    }
    return data.user;
  }, []);

  // Check for existing session on mount (skip if server already provided a user)
  useEffect(() => {
    if (initialUser) return;

    const initAuth = async () => {
      try {
        const savedUser = await fetchSession();
        setUser(savedUser);
      } catch (error) {
        console.error("Auth initialization failed:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchSession, initialUser]);

  /**
   * Sign out (better-auth style)
   */
  const signOutHandler = useCallback(async () => {
    setUser(null);

    try {
      await bvbrcAuth.signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
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
      } else {
        await signOutHandler();
      }
    } catch (error) {
      console.error("Auth refresh failed:", error);
      await signOutHandler();
    }
  }, [fetchSession, signOutHandler]);

  // Revalidate when tab becomes visible (replaces 5-min polling)
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshAuth();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, refreshAuth]);

  // Redirect to sign-in when session is lost on a protected route
  useEffect(() => {
    if (!isLoading && !user && isProtectedPagePath(pathname)) {
      const query = searchParams.toString();
      const fullPath = query ? `${pathname}?${query}` : pathname;
      router.replace(`/sign-in?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [isLoading, user, pathname, searchParams, router]);

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
      } else {
        const userData = await fetchSession();
        if (userData) {
          setUser(userData);
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
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchSession]);

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
    isVerified: user?.email_verified !== false,
  }), [
    user,
    signIn,
    signOutHandler,
    signUp,
    refreshAuth,
    requestPasswordReset,
    sendVerificationEmail,
    isLoading,
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
