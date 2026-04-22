import type { Result } from "@/lib/auth/port";
import type {
  SigninCredentials,
  SignupCredentials,
  UserProfile,
} from "@/lib/auth/types";

export interface SessionIdentity {
  token: string;
  userId: string;
  realm?: string;
  expiresAt: number;
}

export interface SessionStoragePort {
  read(): Promise<SessionIdentity | null>;
  write(identity: SessionIdentity): Promise<void>;
  clear(): Promise<void>;
  readBackup(): Promise<SessionIdentity | null>;
  writeBackup(identity: SessionIdentity): Promise<void>;
  clearBackup(): Promise<void>;
}

export interface IdentityProviderPort {
  authenticate(
    credentials: SigninCredentials,
  ): Promise<Result<{ token: string }>>;
  signUp(input: SignupCredentials): Promise<Result<{ token: string }>>;
  impersonate(
    actingUserId: string,
    targetUser: string,
    password: string,
  ): Promise<Result<{ token: string }>>;
  validateToken(userId: string, token: string): Promise<Result<UserProfile>>;
  fetchProfile(
    userId: string,
    token?: string,
  ): Promise<UserProfile | null>;
  requestPasswordReset(usernameOrEmail: string): Promise<Result<void>>;
  sendVerificationEmail(
    userId: string,
    token: string,
  ): Promise<Result<void>>;
  verifyEmailToken(
    verificationToken: string,
    username: string,
  ): Promise<Result<void>>;
  changePassword(
    userId: string,
    token: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Result<void>>;
}
