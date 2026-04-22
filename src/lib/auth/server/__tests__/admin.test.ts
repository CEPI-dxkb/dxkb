import { createAuth } from "../create";
import {
  inMemoryIdentity,
  inMemorySession,
  type InMemoryAccount,
} from "../adapters/memory";
import type { UserProfile } from "@/lib/auth/types";

function makeProfile(partial: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "alice",
    email: "alice@example.com",
    email_verified: true,
    first_name: "Alice",
    last_name: "Wonder",
    creation_date: "2024-01-01",
    last_login: "2024-01-01",
    organisms: "",
    reverification: false,
    source: "memory",
    l_id: "alice",
    ...partial,
  };
}

function makeAccount(
  overrides: Partial<InMemoryAccount> & Pick<InMemoryAccount, "username">,
): InMemoryAccount {
  return {
    password: "pw",
    token: `${overrides.username}-token`,
    profile: makeProfile({
      id: overrides.username,
      email: `${overrides.username}@example.com`,
      l_id: overrides.username,
    }),
    ...overrides,
  };
}

function buildAuthority(accounts: InMemoryAccount[] = []) {
  const identity = inMemoryIdentity({ accounts, suPassword: "su-pw" });
  const session = inMemorySession();
  const { authAdmin } = createAuth({ identity, session });
  return { authAdmin, identity, session };
}

describe("authAdmin.signIn", () => {
  it("writes the session and returns an AuthUser on success", async () => {
    const { authAdmin, session } = buildAuthority([
      makeAccount({ username: "alice" }),
    ]);

    const result = await authAdmin.signIn({
      username: "alice",
      password: "pw",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual(
      expect.objectContaining({
        username: "alice",
        email: "alice@example.com",
        id: "alice",
        token: "",
      }),
    );
    expect(session.inspect().current?.token).toBe("alice-token");
    expect(session.inspect().current?.userId).toBe("alice");
  });

  it("validates username/password are required", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.signIn({ username: "", password: "" });
    expect(result.error?.code).toBe("validation");
    expect(result.error?.status).toBe(400);
  });

  it("returns invalid_credentials for unknown user", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.signIn({
      username: "ghost",
      password: "pw",
    });
    expect(result.error?.code).toBe("invalid_credentials");
  });

  it("derives userId from the local part of an email-like username when no profile returns", async () => {
    const { authAdmin, session } = buildAuthority([
      {
        ...makeAccount({ username: "user@realm.org" }),
        profile: makeProfile({ id: "" }),
      },
    ]);

    await authAdmin.signIn({
      username: "user@realm.org",
      password: "pw",
    });

    expect(session.inspect().current?.userId).toBe("user");
  });
});

describe("authAdmin.signUp", () => {
  it("creates a session and returns AuthUser with email_verified=false", async () => {
    const { authAdmin, session } = buildAuthority();

    const result = await authAdmin.signUp({
      username: "bob",
      email: "bob@example.com",
      first_name: "Bob",
      last_name: "Smith",
      password: "pw",
      password_repeat: "pw",
    });

    expect(result.error).toBeNull();
    expect(result.data?.email_verified).toBe(false);
    expect(result.data?.username).toBe("bob");
    expect(session.inspect().current?.token).toBe("memory-token:bob");
  });

  it("rejects mismatched passwords", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.signUp({
      username: "bob",
      email: "bob@x",
      first_name: "B",
      last_name: "B",
      password: "a",
      password_repeat: "b",
    });
    expect(result.error?.code).toBe("validation");
    expect(result.error?.message).toBe("Passwords do not match");
  });

  it("rejects missing required fields", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.signUp({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      password_repeat: "",
    });
    expect(result.error?.code).toBe("validation");
  });

  it("returns conflict when username exists", async () => {
    const { authAdmin } = buildAuthority([makeAccount({ username: "alice" })]);
    const result = await authAdmin.signUp({
      username: "alice",
      email: "alice@x",
      first_name: "A",
      last_name: "A",
      password: "pw",
      password_repeat: "pw",
    });
    expect(result.error?.code).toBe("conflict");
  });
});

describe("authAdmin.signOut", () => {
  it("clears the session", async () => {
    const { authAdmin, session } = buildAuthority();
    await session.write({
      token: "t",
      userId: "u",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.signOut();

    expect(result.error).toBeNull();
    expect(session.inspect().current).toBeNull();
  });
});

describe("authAdmin.impersonate", () => {
  const adminAccount: InMemoryAccount = {
    ...makeAccount({ username: "admin" }),
    profile: makeProfile({ id: "admin", roles: ["admin"] }),
  };
  const targetAccount = makeAccount({ username: "alice" });

  it("succeeds when admin impersonates a non-admin", async () => {
    const { authAdmin, session } = buildAuthority([
      adminAccount,
      targetAccount,
    ]);
    await session.write({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.impersonate("alice", "su-pw");

    expect(result.error).toBeNull();
    expect(result.data?.isImpersonating).toBe(true);
    expect(result.data?.originalUsername).toBe("admin");
    expect(session.inspect().current?.token).toBe("alice-token");
    expect(session.inspect().backup?.userId).toBe("admin");
  });

  it("rejects when caller is not authenticated", async () => {
    const { authAdmin } = buildAuthority([adminAccount, targetAccount]);
    const result = await authAdmin.impersonate("alice", "su-pw");
    expect(result.error?.code).toBe("unauthorized");
  });

  it("rejects when caller is not an admin", async () => {
    const nonAdmin = makeAccount({ username: "bob" });
    const { authAdmin, session } = buildAuthority([nonAdmin, targetAccount]);
    await session.write({
      token: "bob-token",
      userId: "bob",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.impersonate("alice", "su-pw");

    expect(result.error?.code).toBe("forbidden");
  });

  it("rejects when target user is unknown", async () => {
    const { authAdmin, session } = buildAuthority([adminAccount]);
    await session.write({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now(),
    });
    const result = await authAdmin.impersonate("ghost", "su-pw");
    expect(result.error?.code).toBe("not_found");
  });

  it("rejects with invalid_credentials on bad SU password", async () => {
    const { authAdmin, session } = buildAuthority([
      adminAccount,
      targetAccount,
    ]);
    await session.write({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.impersonate("alice", "bad");

    expect(result.error?.code).toBe("invalid_credentials");
  });
});

describe("authAdmin.exitImpersonation", () => {
  it("restores the backup session and clears the backup", async () => {
    const { authAdmin, session } = buildAuthority([
      makeAccount({ username: "admin" }),
    ]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    await session.writeBackup({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.exitImpersonation();

    expect(result.error).toBeNull();
    expect(result.data?.username).toBe("admin");
    expect(session.inspect().current?.token).toBe("admin-token");
    expect(session.inspect().backup).toBeNull();
  });

  it("returns validation error when no backup exists", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.exitImpersonation();
    expect(result.error?.code).toBe("validation");
  });
});

describe("authAdmin.requestPasswordReset", () => {
  it("delegates to identity.requestPasswordReset", async () => {
    const { authAdmin, identity } = buildAuthority();
    const result = await authAdmin.requestPasswordReset("alice@example.com");
    expect(result.error).toBeNull();
    expect(identity.resetPasswordRequests()).toContain("alice@example.com");
  });

  it("validates identifier presence", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.requestPasswordReset("");
    expect(result.error?.code).toBe("validation");
  });
});

describe("authAdmin.sendVerificationEmail", () => {
  it("sends the verification email for the current session", async () => {
    const { authAdmin, session, identity } = buildAuthority();
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.sendVerificationEmail();

    expect(result.error).toBeNull();
    expect(identity.verificationEmailRequests()).toEqual([
      { userId: "alice", token: "alice-token" },
    ]);
  });

  it("rejects when no session exists", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.sendVerificationEmail();
    expect(result.error?.code).toBe("unauthorized");
  });
});

describe("authAdmin.verifyEmailToken", () => {
  it("delegates to identity.verifyEmailToken", async () => {
    const { authAdmin } = buildAuthority([
      {
        ...makeAccount({ username: "alice" }),
        profile: makeProfile({ id: "alice", email_verified: false }),
      },
    ]);
    const result = await authAdmin.verifyEmailToken("vtok", "alice");
    expect(result.error).toBeNull();
  });

  it("validates both fields", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.verifyEmailToken("", "alice");
    expect(result.error?.code).toBe("validation");
  });
});

describe("authAdmin.changePassword", () => {
  it("changes the password for the current session", async () => {
    const { authAdmin, session, identity } = buildAuthority([
      makeAccount({ username: "alice" }),
    ]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.changePassword("pw", "new-pw");

    expect(result.error).toBeNull();
    const re = await identity.authenticate({
      username: "alice",
      password: "new-pw",
    });
    expect(re.error).toBeNull();
  });

  it("rejects when not authenticated", async () => {
    const { authAdmin } = buildAuthority();
    const result = await authAdmin.changePassword("pw", "new-pw");
    expect(result.error?.code).toBe("unauthorized");
  });

  it("validates field presence", async () => {
    const { authAdmin, session } = buildAuthority([
      makeAccount({ username: "alice" }),
    ]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    const result = await authAdmin.changePassword("", "new");
    expect(result.error?.code).toBe("validation");
  });
});

describe("authAdmin.currentSession", () => {
  it("refreshes the session and returns the user when token validates", async () => {
    const { authAdmin, session } = buildAuthority([
      makeAccount({ username: "alice" }),
    ]);
    const initial = {
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    };
    await session.write(initial);

    const result = await authAdmin.currentSession();

    expect(result.error).toBeNull();
    expect(result.data?.username).toBe("alice");
    // Refreshed: still exists afterwards
    expect(session.inspect().current?.token).toBe("alice-token");
  });

  it("clears cookies and returns null when no session exists", async () => {
    const { authAdmin, session } = buildAuthority();
    const result = await authAdmin.currentSession();
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
    expect(session.inspect().current).toBeNull();
  });

  it("clears cookies and returns null when token fails validation", async () => {
    const { authAdmin, session } = buildAuthority([
      makeAccount({ username: "alice" }),
    ]);
    await session.write({
      token: "stale-token",
      userId: "alice",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.currentSession();

    expect(result.data).toBeNull();
    expect(session.inspect().current).toBeNull();
  });

  it("surfaces impersonation state from the backup cookie", async () => {
    const { authAdmin, session } = buildAuthority([
      makeAccount({ username: "alice" }),
    ]);
    await session.write({
      token: "alice-token",
      userId: "alice",
      expiresAt: Date.now(),
    });
    await session.writeBackup({
      token: "admin-token",
      userId: "admin",
      expiresAt: Date.now(),
    });

    const result = await authAdmin.currentSession();

    expect(result.data?.isImpersonating).toBe(true);
    expect(result.data?.originalUsername).toBe("admin");
  });
});
