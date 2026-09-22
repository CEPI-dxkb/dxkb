"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import * as authClient from "@/lib/auth/client";
import type {
  AuthUser,
  ProfilePatch,
  SigninCredentials,
  SignupCredentials,
} from "@/lib/auth/types";

const AuthContext = createContext<AuthUser | null | undefined>(undefined);

export interface AuthBoundaryProps {
  children: ReactNode;
  user: AuthUser | null;
}

export function AuthBoundary({ children, user }: AuthBoundaryProps) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
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
  };
}

export function useExitImpersonation() {
  const { exitImpersonation } = useAuthActions();

  return async () => {
    try {
      await exitImpersonation();
      toast.success("Returned to your account");
    } catch {
      toast.error("Failed to exit impersonation");
    }
  };
}

export function useResendVerificationEmail(): () => Promise<void> {
  const { sendVerificationEmail } = useAuthActions();

  return async () => {
    try {
      await sendVerificationEmail();
      toast.success("Verification email sent");
    } catch {
      toast.error("Failed to send verification email");
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
