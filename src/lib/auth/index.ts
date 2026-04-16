export type {
  AuthUser,
  UserProfile,
  SigninCredentials,
  SignupCredentials,
  PasswordResetRequest,
  PasswordResetResponse,
} from "@/lib/auth/types";

export type {
  AuthPort,
  AuthError,
  AuthErrorCode,
  Result,
} from "@/lib/auth/port";

export type {
  AuthEventMap,
  AuthEventName,
  AuthEventHandler,
  SessionLostReason,
} from "@/lib/auth/events";

export type { AuthStore, AuthSnapshot, AuthStatus } from "@/lib/auth/store";

export { AuthBoundary } from "@/lib/auth/provider";
export { useAuth, useSignIn } from "@/lib/auth/hooks";
export { apiFetch } from "@/lib/auth/fetch";
export { authAdmin, authAccount } from "@/lib/auth/advanced";

export { httpAuthAdapter } from "@/lib/auth/adapters/http";
export { memoryAuthAdapter } from "@/lib/auth/adapters/memory";
export type { MemoryAuthAdapter, MemoryAdapterOptions } from "@/lib/auth/adapters/memory";

export {
  createAuthStore,
  setActiveAuthStore,
  getActiveAuthStore,
} from "@/lib/auth/store";

export {
  isProtectedPagePath,
  isProtectedApiPath,
} from "@/lib/auth/routes";
