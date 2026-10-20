"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import * as authClient from "@/lib/auth/client";
import { formatPrefixedErrorMessage } from "@/lib/utils";
import type {
  AuthUser,
  ProfilePatch,
  SigninCredentials,
  SignupCredentials,
} from "@/lib/auth/types";

const AuthContext = createContext<AuthUser | null | undefined>(undefined);

interface SessionNoticeState {
  dismissed: boolean;
  dismiss: () => void;
}

const SessionNoticeContext = createContext<SessionNoticeState | null>(null);

export interface AuthBoundaryProps {
  children: ReactNode;
  user: AuthUser | null;
}

export function AuthBoundary({ children, user }: AuthBoundaryProps) {
  // Held here rather than in the banner because every layout mounts its own
  // navbar, while the root layout's boundary lives for the whole visit.
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const notice = {
    dismissed: noticeDismissed,
    dismiss: () => {
      setNoticeDismissed(true);
    },
  };

  return (
    <AuthContext.Provider value={user}>
      <SessionNoticeContext.Provider value={notice}>
        {children}
      </SessionNoticeContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const user = useContext(AuthContext);
  if (user === undefined) {
    throw new Error("useAuth must be used within <AuthBoundary>");
  }

  return {
    user,
    isAuthenticated: user !== null,
    isVerified: !!user && user.email_verified !== false,
    isAdmin: user?.roles?.includes("admin") ?? false,
    isImpersonating: user?.isImpersonating ?? false,
    originalUsername: user?.originalUsername ?? null,
    isSessionUnverified: user?.sessionUnverified ?? false,
  };
}

/**
 * The outage notice for a session the profile service could not verify: shown
 * until dismissed, and dismissed for the rest of the visit.
 */
export function useSessionUnverifiedNotice() {
  const { user, isSessionUnverified } = useAuth();
  const notice = useContext(SessionNoticeContext);
  if (!notice) {
    throw new Error(
      "useSessionUnverifiedNotice must be used within <AuthBoundary>",
    );
  }

  return {
    visible: isSessionUnverified && !notice.dismissed,
    reason: user?.sessionUnverifiedReason ?? null,
    dismiss: notice.dismiss,
  };
}

export function useExitImpersonation() {
  const { exitImpersonation } = useAuthActions();

  return async () => {
    try {
      await exitImpersonation();
      toast.success("Returned to your account");
    } catch (error) {
      toast.error(
        formatPrefixedErrorMessage("Failed to exit impersonation", error),
      );
    }
  };
}

export function useResendVerificationEmail(): () => Promise<void> {
  const { sendVerificationEmail } = useAuthActions();

  return async () => {
    try {
      await sendVerificationEmail();
      toast.success("Verification email sent");
    } catch (error) {
      toast.error(
        formatPrefixedErrorMessage("Failed to send verification email", error),
      );
    }
  };
}

export function useAuthActions() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const clearAccountCache = () => {
    queryClient.clear();
  };

  const signIn = async (credentials: SigninCredentials) => {
    const user = await authClient.signIn(credentials);
    clearAccountCache();
    return user;
  };
  const signUp = async (input: SignupCredentials) => {
    const user = await authClient.signUp(input);
    clearAccountCache();
    return user;
  };
  const startImpersonation = async (targetUser: string, password: string) => {
    const user = await authClient.startImpersonation(targetUser, password);
    clearAccountCache();
    router.refresh();
    return user;
  };
  const exitImpersonation = async () => {
    const user = await authClient.exitImpersonation();
    clearAccountCache();
    router.refresh();
    return user;
  };
  const updateProfile = async (patches: ProfilePatch[]) => {
    await authClient.updateProfile(patches);
    await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    router.refresh();
  };

  return {
    signIn,
    signUp,
    startImpersonation,
    exitImpersonation,
    requestPasswordReset: (usernameOrEmail: string) =>
      authClient.requestPasswordReset(usernameOrEmail),
    sendVerificationEmail: () => authClient.sendVerificationEmail(),
    changePassword: (currentPassword: string, newPassword: string) =>
      authClient.changePassword(currentPassword, newPassword),
    updateProfile,
  };
}
