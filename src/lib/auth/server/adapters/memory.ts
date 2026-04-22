import type { AuthError, AuthErrorCode, Result } from "@/lib/auth/port";
import type {
  SigninCredentials,
  SignupCredentials,
  UserProfile,
} from "@/lib/auth/types";
import type {
  IdentityProviderPort,
  SessionIdentity,
  SessionStoragePort,
} from "../ports";

export interface InMemoryAccount {
  username: string;
  password: string;
  token: string;
  profile: UserProfile;
}

export interface InMemoryIdentityOptions {
  accounts?: InMemoryAccount[];
  suPassword?: string;
  clockMs?: () => number;
}

export interface InMemoryIdentityAdapter extends IdentityProviderPort {
  addAccount(account: InMemoryAccount): void;
  getAccount(username: string): InMemoryAccount | undefined;
  resetPasswordRequests(): string[];
  verificationEmailRequests(): { userId: string; token: string }[];
}

function fail<T>(
  message: string,
  code: AuthErrorCode,
  status?: number,
): Result<T> {
  return { data: null, error: { message, code, status } as AuthError };
}

function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function inMemoryIdentity(
  options: InMemoryIdentityOptions = {},
): InMemoryIdentityAdapter {
  const accounts = new Map<string, InMemoryAccount>();
  for (const account of options.accounts ?? []) {
    accounts.set(account.username, account);
  }
  const resetRequests: string[] = [];
  const verifyRequests: { userId: string; token: string }[] = [];

  function findByToken(token: string): InMemoryAccount | undefined {
    for (const account of accounts.values()) {
      if (account.token === token) return account;
    }
    return undefined;
  }

  return {
    addAccount(account) {
      accounts.set(account.username, account);
    },
    getAccount(username) {
      return accounts.get(username);
    },
    resetPasswordRequests() {
      return [...resetRequests];
    },
    verificationEmailRequests() {
      return [...verifyRequests];
    },

    async authenticate({ username, password }: SigninCredentials) {
      const account = accounts.get(username);
      if (!account || account.password !== password) {
        return fail("Invalid credentials", "invalid_credentials", 401);
      }
      return ok({ token: account.token });
    },

    async signUp(input: SignupCredentials) {
      if (accounts.has(input.username)) {
        return fail("Username already exists", "conflict", 409);
      }
      const account: InMemoryAccount = {
        username: input.username,
        password: input.password,
        token: `memory-token:${input.username}`,
        profile: {
          id: input.username,
          email: input.email,
          email_verified: false,
          first_name: input.first_name,
          last_name: input.last_name,
          creation_date: new Date().toISOString(),
          last_login: new Date().toISOString(),
          organisms: input.organisms ?? "",
          reverification: false,
          source: "memory",
          l_id: input.username,
        },
      };
      accounts.set(input.username, account);
      return ok({ token: account.token });
    },

    async impersonate(_actingUserId, targetUser, password) {
      if (options.suPassword !== undefined && password !== options.suPassword) {
        return fail("Invalid credentials", "invalid_credentials", 401);
      }
      const target = accounts.get(targetUser);
      if (!target) {
        return fail("Target user not found", "not_found", 404);
      }
      return ok({ token: target.token });
    },

    async validateToken(userId, token) {
      const account = accounts.get(userId) ?? findByToken(token);
      if (!account || account.token !== token) {
        return fail("Token validation failed", "unauthorized", 401);
      }
      return ok(account.profile);
    },

    async fetchProfile(userId) {
      return accounts.get(userId)?.profile ?? null;
    },

    async requestPasswordReset(usernameOrEmail) {
      resetRequests.push(usernameOrEmail);
      return ok(undefined);
    },

    async sendVerificationEmail(userId, token) {
      verifyRequests.push({ userId, token });
      return ok(undefined);
    },

    async verifyEmailToken(_verificationToken, username) {
      const account = accounts.get(username);
      if (!account) return fail("User not found", "not_found", 404);
      accounts.set(username, {
        ...account,
        profile: { ...account.profile, email_verified: true },
      });
      return ok(undefined);
    },

    async changePassword(userId, token, currentPassword, newPassword) {
      const account = accounts.get(userId);
      if (!account || account.token !== token) {
        return fail("Unauthorized", "unauthorized", 401);
      }
      if (account.password !== currentPassword) {
        return fail("Current password is incorrect", "validation", 400);
      }
      accounts.set(userId, { ...account, password: newPassword });
      return ok(undefined);
    },
  };
}

export interface InMemorySessionOptions {
  initial?: SessionIdentity | null;
  initialBackup?: SessionIdentity | null;
}

export interface InMemorySessionAdapter extends SessionStoragePort {
  inspect(): { current: SessionIdentity | null; backup: SessionIdentity | null };
}

export function inMemorySession(
  options: InMemorySessionOptions = {},
): InMemorySessionAdapter {
  let current: SessionIdentity | null = options.initial ?? null;
  let backup: SessionIdentity | null = options.initialBackup ?? null;

  return {
    inspect() {
      return { current, backup };
    },

    async read() {
      return current;
    },
    async write(identity) {
      current = identity;
    },
    async clear() {
      current = null;
      backup = null;
    },
    async readBackup() {
      return backup;
    },
    async writeBackup(identity) {
      backup = identity;
    },
    async clearBackup() {
      backup = null;
    },
  };
}
