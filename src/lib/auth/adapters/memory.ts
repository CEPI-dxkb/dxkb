import type { AuthPort, AuthErrorCode, Result } from "@/lib/auth/port";
import type {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
} from "@/lib/auth/types";

interface MemoryAccount {
  user: AuthUser;
  password: string;
}

export interface MemoryAdapterOptions {
  accounts?: MemoryAccount[];
  initialSession?: AuthUser | null;
  onRequest?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface MemoryAuthAdapter extends AuthPort {
  setSession(user: AuthUser | null): void;
  addAccount(account: MemoryAccount): void;
}

export function memoryAuthAdapter(
  options: MemoryAdapterOptions = {},
): MemoryAuthAdapter {
  const accounts = new Map<string, MemoryAccount>();
  for (const account of options.accounts ?? []) {
    accounts.set(account.user.username, account);
  }

  let session: AuthUser | null = options.initialSession ?? null;
  let impersonationBackup: AuthUser | null = null;

  const fail = <T>(message: string, code: AuthErrorCode): Result<T> => ({
    data: null,
    error: { message, code },
  });

  return {
    setSession(user) {
      session = user;
    },
    addAccount(account) {
      accounts.set(account.user.username, account);
    },

    async getSession() {
      return { data: session, error: null };
    },

    async signIn({ username, password }: SigninCredentials) {
      const account = accounts.get(username);
      if (!account || account.password !== password) {
        return fail("Invalid credentials", "invalid_credentials");
      }
      session = account.user;
      return { data: session, error: null };
    },

    async signUp(input: SignupCredentials) {
      if (accounts.has(input.username)) {
        return fail("Username already exists", "conflict");
      }
      const user: AuthUser = {
        username: input.username,
        email: input.email,
        token: "memory-token",
        first_name: input.first_name,
        last_name: input.last_name,
        email_verified: false,
      };
      accounts.set(input.username, { user, password: input.password });
      session = user;
      return { data: user, error: null };
    },

    async signOut() {
      session = null;
      impersonationBackup = null;
      return { data: undefined, error: null };
    },

    async impersonate(targetUser, password) {
      if (!session) {
        return fail("Not authenticated", "unauthorized");
      }
      const target = accounts.get(targetUser);
      if (!target || target.password !== password) {
        return fail("Invalid credentials", "invalid_credentials");
      }
      impersonationBackup = session;
      session = {
        ...target.user,
        isImpersonating: true,
        originalUsername: impersonationBackup.username,
      };
      return { data: session, error: null };
    },

    async exitImpersonation() {
      if (!impersonationBackup) {
        return fail("No active impersonation session", "validation");
      }
      session = impersonationBackup;
      impersonationBackup = null;
      return { data: session, error: null };
    },

    async requestPasswordReset() {
      return { data: undefined, error: null };
    },

    async sendVerificationEmail() {
      return { data: undefined, error: null };
    },

    request(input, init) {
      if (options.onRequest) return options.onRequest(input, init);
      return Promise.resolve(
        new Response(null, { status: session ? 200 : 401 }),
      );
    },
  };
}
