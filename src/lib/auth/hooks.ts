"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import type { AuthError, Result } from "@/lib/auth/port";
import { useAuthStore } from "@/lib/auth/provider";
import type {
  AuthUser,
  SigninCredentials,
} from "@/lib/auth/types";

export interface UseAuthResult {
  user: AuthUser | null;
  status: "loading" | "authed" | "guest";
  isAuthenticated: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  originalUsername: string | null;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const store = useAuthStore();
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.snapshot,
  );
  const { user, status } = snapshot;

  return {
    user,
    status,
    isAuthenticated: status === "authed",
    isVerified: !!user && user.email_verified !== false,
    isAdmin: user?.roles?.includes("admin") ?? false,
    isImpersonating: user?.isImpersonating ?? false,
    originalUsername: user?.originalUsername ?? null,
    signOut: () => store.signOut("user"),
  };
}

export interface UseSignInResult {
  signIn: (credentials: SigninCredentials) => Promise<Result<AuthUser>>;
  isPending: boolean;
  error: AuthError | null;
}

export function useSignIn(): UseSignInResult {
  const store = useAuthStore();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const signIn = useCallback(
    async (credentials: SigninCredentials) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await store.signIn(credentials);
        if (result.error) setError(result.error);
        return result;
      } finally {
        setIsPending(false);
      }
    },
    [store],
  );

  return { signIn, isPending, error };
}
