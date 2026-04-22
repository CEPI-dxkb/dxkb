import type { Result } from "@/lib/auth/port";
import type {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
  UserProfile,
} from "@/lib/auth/types";
import { ok, fail, forwardError } from "./result";
import { sessionMaxAgeMs } from "./envelope";
import { extractRealmFromToken } from "./token";
import type {
  IdentityProviderPort,
  SessionIdentity,
  SessionStoragePort,
} from "./ports";

const allowAdminToAdminImpersonation = true;

export interface AuthAdmin {
  signIn(credentials: SigninCredentials): Promise<Result<AuthUser>>;
  signUp(input: SignupCredentials): Promise<Result<AuthUser>>;
  signOut(): Promise<Result<void>>;
  impersonate(
    targetUser: string,
    password: string,
  ): Promise<Result<AuthUser>>;
  exitImpersonation(): Promise<Result<AuthUser>>;
  requestPasswordReset(usernameOrEmail: string): Promise<Result<void>>;
  sendVerificationEmail(): Promise<Result<void>>;
  verifyEmailToken(
    verificationToken: string,
    username: string,
  ): Promise<Result<void>>;
  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<Result<void>>;
  currentSession(): Promise<Result<AuthUser | null>>;
}

export interface AuthAdminPorts {
  identity: IdentityProviderPort;
  session: SessionStoragePort;
}

function deriveUserId(username: string, profileId?: string): string {
  if (profileId) return profileId;
  const at = username.indexOf("@");
  return at === -1 ? username : username.substring(0, at);
}

function buildSessionIdentity(
  token: string,
  userId: string,
  realm: string | undefined,
): SessionIdentity {
  return {
    token,
    userId,
    realm,
    expiresAt: Date.now() + sessionMaxAgeMs,
  };
}

function buildBaseUser(
  username: string,
  realm: string | undefined,
  profile: UserProfile | null,
): AuthUser {
  return {
    id: profile?.id || username,
    username,
    email: profile?.email || "",
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email_verified: profile?.email_verified || false,
    realm,
    token: "",
  };
}

export function createAuthAdmin(ports: AuthAdminPorts): AuthAdmin {
  const { identity, session } = ports;

  async function signIn(
    credentials: SigninCredentials,
  ): Promise<Result<AuthUser>> {
    if (!credentials.username || !credentials.password) {
      return fail(
        "validation",
        "Username and password are required",
        400,
      );
    }

    const authResult = await identity.authenticate(credentials);
    if (authResult.error) return forwardError(authResult.error);

    const token = authResult.data.token;
    const realm = extractRealmFromToken(token);
    const profile = await identity.fetchProfile(credentials.username, token);
    const userId = deriveUserId(credentials.username, profile?.id);

    await session.write(buildSessionIdentity(token, userId, realm));

    return ok(buildBaseUser(credentials.username, realm, profile));
  }

  async function signUp(input: SignupCredentials): Promise<Result<AuthUser>> {
    if (!input.username || !input.email || !input.password) {
      return fail(
        "validation",
        "Username, email, and password are required",
        400,
      );
    }
    if (input.password !== input.password_repeat) {
      return fail("validation", "Passwords do not match", 400);
    }

    const signUpResult = await identity.signUp(input);
    if (signUpResult.error) return forwardError(signUpResult.error);

    const token = signUpResult.data.token;
    const realm = extractRealmFromToken(token);
    const profile = await identity.fetchProfile(input.username, token);
    const userId = deriveUserId(input.username, profile?.id);

    await session.write(buildSessionIdentity(token, userId, realm));

    return ok({
      ...buildBaseUser(input.username, realm, profile),
      email: input.email,
      first_name: input.first_name || "",
      last_name: input.last_name || "",
      email_verified: false,
    });
  }

  async function signOut(): Promise<Result<void>> {
    await session.clear();
    return ok(undefined);
  }

  async function impersonate(
    targetUser: string,
    password: string,
  ): Promise<Result<AuthUser>> {
    if (!targetUser || !password) {
      return fail(
        "validation",
        "Target user and password are required",
        400,
      );
    }

    const current = await session.read();
    if (!current) {
      return fail("unauthorized", "Authentication required", 401);
    }

    const adminProfile = await identity.fetchProfile(
      current.userId,
      current.token,
    );
    if (!adminProfile?.roles?.includes("admin")) {
      return fail("forbidden", "Admin role required", 403);
    }

    const impResult = await identity.impersonate(
      current.userId,
      targetUser,
      password,
    );
    if (impResult.error) return forwardError(impResult.error);

    const targetToken = impResult.data.token;
    const targetRealm = extractRealmFromToken(targetToken);
    const targetProfile = await identity.fetchProfile(
      targetUser,
      targetToken,
    );

    if (
      !allowAdminToAdminImpersonation &&
      targetProfile?.roles?.includes("admin")
    ) {
      return fail("forbidden", "Cannot impersonate another admin", 403);
    }

    await session.writeBackup(current);
    await session.write(
      buildSessionIdentity(targetToken, targetUser, targetRealm),
    );

    return ok({
      ...buildBaseUser(targetUser, targetRealm, targetProfile),
      roles: targetProfile?.roles || [],
      isImpersonating: true,
      originalUsername: current.userId,
    });
  }

  async function exitImpersonation(): Promise<Result<AuthUser>> {
    const backup = await session.readBackup();
    if (!backup) {
      return fail("validation", "No active impersonation session", 400);
    }

    await session.write(backup);
    await session.clearBackup();

    const profile = await identity.fetchProfile(backup.userId, backup.token);

    return ok({
      ...buildBaseUser(backup.userId, backup.realm, profile),
      roles: profile?.roles || [],
    });
  }

  async function requestPasswordReset(
    usernameOrEmail: string,
  ): Promise<Result<void>> {
    if (!usernameOrEmail) {
      return fail("validation", "Email or username is required", 400);
    }
    const result = await identity.requestPasswordReset(usernameOrEmail);
    if (result.error) return forwardError(result.error);
    return ok(undefined);
  }

  async function sendVerificationEmail(): Promise<Result<void>> {
    const current = await session.read();
    if (!current) {
      return fail("unauthorized", "Authentication required", 401);
    }
    const result = await identity.sendVerificationEmail(
      current.userId,
      current.token,
    );
    if (result.error) return forwardError(result.error);
    return ok(undefined);
  }

  async function verifyEmailToken(
    verificationToken: string,
    username: string,
  ): Promise<Result<void>> {
    if (!verificationToken || !username) {
      return fail(
        "validation",
        "Verification token and username are required",
        400,
      );
    }
    const result = await identity.verifyEmailToken(
      verificationToken,
      username,
    );
    if (result.error) return forwardError(result.error);
    return ok(undefined);
  }

  async function changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<Result<void>> {
    if (!currentPassword || !newPassword) {
      return fail(
        "validation",
        "Current password and new password are required",
        400,
      );
    }
    const current = await session.read();
    if (!current) {
      return fail("unauthorized", "Authentication required", 401);
    }
    const result = await identity.changePassword(
      current.userId,
      current.token,
      currentPassword,
      newPassword,
    );
    if (result.error) return forwardError(result.error);
    return ok(undefined);
  }

  async function currentSession(): Promise<Result<AuthUser | null>> {
    const current = await session.read();
    if (!current) {
      await session.clear();
      return ok(null);
    }

    const validation = await identity.validateToken(
      current.userId,
      current.token,
    );
    if (validation.error) {
      await session.clear();
      return ok(null);
    }

    await session.write(current);

    const backup = await session.readBackup();
    const profile = validation.data;

    return ok({
      ...buildBaseUser(current.userId, current.realm, profile),
      roles: profile.roles,
      ...(backup
        ? { isImpersonating: true, originalUsername: backup.userId }
        : {}),
    });
  }

  return {
    signIn,
    signUp,
    signOut,
    impersonate,
    exitImpersonation,
    requestPasswordReset,
    sendVerificationEmail,
    verifyEmailToken,
    changePassword,
    currentSession,
  };
}
