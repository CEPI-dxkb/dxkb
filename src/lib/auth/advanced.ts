"use client";

import type { AuthError, Result } from "@/lib/auth/port";
import { getActiveAuthStore, type AuthStore } from "@/lib/auth/store";
import type {
  AuthEventHandler,
  AuthEventName,
} from "@/lib/auth/events";
import type {
  AuthUser,
  SignupCredentials,
} from "@/lib/auth/types";

const notMountedError: AuthError = {
  message: "Auth is not ready",
  code: "unknown",
};

async function withStore<T>(
  fn: (store: AuthStore) => Promise<Result<T>>,
): Promise<Result<T>> {
  const store = getActiveAuthStore();
  if (!store) return { data: null, error: notMountedError };
  return fn(store);
}

export const authAdmin = {
  impersonate: {
    start(targetUser: string, password: string): Promise<Result<AuthUser>> {
      return withStore((s) => s.impersonate(targetUser, password));
    },
    exit(): Promise<Result<AuthUser>> {
      return withStore((s) => s.exitImpersonation());
    },
    state(): { isImpersonating: boolean; originalUsername: string | null } {
      const snapshot = getActiveAuthStore()?.snapshot();
      return {
        isImpersonating: snapshot?.user?.isImpersonating ?? false,
        originalUsername: snapshot?.user?.originalUsername ?? null,
      };
    },
  },
  on<E extends AuthEventName>(
    event: E,
    handler: AuthEventHandler<E>,
  ): () => void {
    const store = getActiveAuthStore();
    if (!store) {
      throw new Error(
        "authAdmin.on called before <AuthBoundary> mounted. Wrap your app with <AuthBoundary> first.",
      );
    }
    return store.events.on(event, handler);
  },
};

export const authAccount = {
  signUp(input: SignupCredentials): Promise<Result<AuthUser>> {
    return withStore((s) => s.signUp(input));
  },
  requestPasswordReset(usernameOrEmail: string): Promise<Result<void>> {
    return withStore((s) => s.requestPasswordReset(usernameOrEmail));
  },
  sendVerificationEmail(): Promise<Result<void>> {
    return withStore((s) => s.sendVerificationEmail());
  },
  async refresh(): Promise<void> {
    await getActiveAuthStore()?.refresh();
  },
};
