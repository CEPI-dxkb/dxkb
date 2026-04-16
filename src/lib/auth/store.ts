import type { AuthPort, Result } from "@/lib/auth/port";
import type {
  AuthUser,
  SigninCredentials,
  SignupCredentials,
} from "@/lib/auth/types";
import {
  createAuthEventBus,
  type AuthEventBus,
  type AuthEventMap,
  type SessionLostReason,
} from "@/lib/auth/events";

type SessionAcquiredVia = AuthEventMap["session:acquired"]["via"];

export type AuthStatus = "loading" | "authed" | "guest";

export interface AuthSnapshot {
  user: AuthUser | null;
  status: AuthStatus;
}

export interface AuthStore {
  snapshot(): AuthSnapshot;
  subscribe(listener: () => void): () => void;
  events: AuthEventBus;

  refresh(): Promise<void>;
  signIn(credentials: SigninCredentials): Promise<Result<AuthUser>>;
  signUp(input: SignupCredentials): Promise<Result<AuthUser>>;
  signOut(reason?: SessionLostReason): Promise<void>;
  impersonate(targetUser: string, password: string): Promise<Result<AuthUser>>;
  exitImpersonation(): Promise<Result<AuthUser>>;
  requestPasswordReset(usernameOrEmail: string): Promise<Result<void>>;
  sendVerificationEmail(): Promise<Result<void>>;

  authenticatedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response>;
}

export interface CreateAuthStoreOptions {
  port: AuthPort;
  initialUser?: AuthUser | null;
  events?: AuthEventBus;
}

export function createAuthStore(options: CreateAuthStoreOptions): AuthStore {
  const { port, events = createAuthEventBus() } = options;
  const initialUser = options.initialUser ?? null;

  let snapshot: AuthSnapshot = initialUser
    ? { user: initialUser, status: "loading" }
    : { user: null, status: "loading" };

  const listeners = new Set<() => void>();
  let inflightRefresh: Promise<void> | null = null;

  function userKey(user: AuthUser | null): string | null {
    if (!user) return null;
    return `${user.id ?? user.username}|${user.token}|${user.expires_at ?? ""}|${user.isImpersonating ?? false}`;
  }

  function setSnapshot(next: AuthSnapshot): void {
    if (
      next.status === snapshot.status &&
      userKey(next.user) === userKey(snapshot.user)
    ) {
      return;
    }
    snapshot = next;
    for (const listener of listeners) listener();
  }

  async function hydrateFromPort(): Promise<void> {
    const { data, error } = await port.getSession();
    if (error) {
      setSnapshot({ user: null, status: "guest" });
      return;
    }
    if (data) {
      setSnapshot({ user: data, status: "authed" });
      events.emit("session:refreshed", { user: data });
    } else {
      setSnapshot({ user: null, status: "guest" });
    }
  }

  async function refresh(): Promise<void> {
    if (inflightRefresh) return inflightRefresh;
    inflightRefresh = (async () => {
      try {
        await hydrateFromPort();
      } finally {
        inflightRefresh = null;
      }
    })();
    return inflightRefresh;
  }

  async function acquireSession<A extends unknown[]>(
    portCall: (...args: A) => Promise<Result<AuthUser>>,
    via: SessionAcquiredVia,
    ...args: A
  ): Promise<Result<AuthUser>> {
    const result = await portCall(...args);
    if (result.data) {
      setSnapshot({ user: result.data, status: "authed" });
      events.emit("session:acquired", { user: result.data, via });
    }
    return result;
  }

  async function signOut(reason: SessionLostReason = "user"): Promise<void> {
    const previousUser = snapshot.user;
    setSnapshot({ user: null, status: "guest" });
    if (reason === "user" || reason === "impersonation-exit") {
      await port.signOut().catch(() => undefined);
    }
    if (previousUser) {
      events.emit("session:lost", { reason });
    }
  }

  async function authenticatedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await port.request(input, init);
    if (response.status !== 401) return response;

    try {
      await refresh();
    } catch {
      return response;
    }

    if (snapshot.status !== "authed") {
      return response;
    }

    return port.request(input, init);
  }

  return {
    snapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    events,

    refresh,

    async signIn(credentials) {
      return acquireSession(port.signIn.bind(port), "signIn", credentials);
    },

    async signUp(input) {
      return acquireSession(port.signUp.bind(port), "signUp", input);
    },

    signOut,

    async impersonate(targetUser, password) {
      return acquireSession(
        port.impersonate.bind(port),
        "impersonate",
        targetUser,
        password,
      );
    },

    async exitImpersonation() {
      return acquireSession(
        port.exitImpersonation.bind(port),
        "exit-impersonate",
      );
    },

    async requestPasswordReset(usernameOrEmail) {
      return port.requestPasswordReset(usernameOrEmail);
    },

    async sendVerificationEmail() {
      return port.sendVerificationEmail();
    },

    authenticatedFetch,
  };
}

let activeStore: AuthStore | null = null;

export function setActiveAuthStore(store: AuthStore | null): void {
  activeStore = store;
}

export function getActiveAuthStore(): AuthStore | null {
  return activeStore;
}
