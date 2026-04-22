import {
  inMemoryIdentity,
  inMemorySession,
  type InMemoryAccount,
} from "../memory";

const aliceAccount: InMemoryAccount = {
  username: "alice",
  password: "pw",
  token: "alice-token",
  profile: {
    id: "alice",
    email: "alice@example.com",
    email_verified: true,
    first_name: "Alice",
    last_name: "Wonderland",
    creation_date: "2024-01-01",
    last_login: "2024-01-01",
    organisms: "",
    reverification: false,
    source: "memory",
    l_id: "alice",
  },
};

describe("inMemoryIdentity().authenticate", () => {
  it("returns the token when credentials match", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.authenticate({
      username: "alice",
      password: "pw",
    });

    expect(result.data?.token).toBe("alice-token");
  });

  it("returns invalid_credentials when password is wrong", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.authenticate({
      username: "alice",
      password: "bad",
    });

    expect(result.error?.code).toBe("invalid_credentials");
  });

  it("returns invalid_credentials when user is unknown", async () => {
    const identity = inMemoryIdentity();

    const result = await identity.authenticate({
      username: "ghost",
      password: "pw",
    });

    expect(result.error?.code).toBe("invalid_credentials");
  });
});

describe("inMemoryIdentity().validateToken", () => {
  it("returns the profile when the token matches the account", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.validateToken("alice", "alice-token");

    expect(result.data?.id).toBe("alice");
  });

  it("returns unauthorized when the token does not match", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.validateToken("alice", "wrong-token");

    expect(result.error?.code).toBe("unauthorized");
  });
});

describe("inMemoryIdentity().impersonate", () => {
  it("returns the target token when suPassword matches", async () => {
    const identity = inMemoryIdentity({
      accounts: [aliceAccount],
      suPassword: "su",
    });

    const result = await identity.impersonate("admin", "alice", "su");

    expect(result.data?.token).toBe("alice-token");
  });

  it("returns invalid_credentials when suPassword mismatches", async () => {
    const identity = inMemoryIdentity({
      accounts: [aliceAccount],
      suPassword: "su",
    });

    const result = await identity.impersonate("admin", "alice", "bad");

    expect(result.error?.code).toBe("invalid_credentials");
  });

  it("returns not_found when target user is missing", async () => {
    const identity = inMemoryIdentity({ suPassword: "su" });

    const result = await identity.impersonate("admin", "ghost", "su");

    expect(result.error?.code).toBe("not_found");
  });
});

describe("inMemoryIdentity().signUp", () => {
  it("creates a new account and returns a token", async () => {
    const identity = inMemoryIdentity();

    const result = await identity.signUp({
      username: "bob",
      email: "bob@example.com",
      first_name: "Bob",
      last_name: "Smith",
      password: "pw",
      password_repeat: "pw",
    });

    expect(result.data?.token).toBe("memory-token:bob");
    expect(identity.getAccount("bob")).toBeDefined();
  });

  it("returns conflict when the username is taken", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.signUp({
      username: "alice",
      email: "alice@x.com",
      first_name: "A",
      last_name: "A",
      password: "pw",
      password_repeat: "pw",
    });

    expect(result.error?.code).toBe("conflict");
  });
});

describe("inMemoryIdentity().changePassword", () => {
  it("rejects when the token does not match", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.changePassword(
      "alice",
      "wrong",
      "pw",
      "new",
    );

    expect(result.error?.code).toBe("unauthorized");
  });

  it("rejects when the current password is wrong", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.changePassword(
      "alice",
      "alice-token",
      "bad",
      "new",
    );

    expect(result.error?.code).toBe("validation");
  });

  it("updates the password on success", async () => {
    const identity = inMemoryIdentity({ accounts: [aliceAccount] });

    const result = await identity.changePassword(
      "alice",
      "alice-token",
      "pw",
      "new",
    );

    expect(result.error).toBeNull();

    const reauth = await identity.authenticate({
      username: "alice",
      password: "new",
    });
    expect(reauth.error).toBeNull();
  });
});

describe("inMemoryIdentity side-effect recorders", () => {
  it("requestPasswordReset records each call", async () => {
    const identity = inMemoryIdentity();

    await identity.requestPasswordReset("alice@example.com");
    await identity.requestPasswordReset("bob@example.com");

    expect(identity.resetPasswordRequests()).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("sendVerificationEmail records each call", async () => {
    const identity = inMemoryIdentity();

    await identity.sendVerificationEmail("alice", "tok");

    expect(identity.verificationEmailRequests()).toEqual([
      { userId: "alice", token: "tok" },
    ]);
  });

  it("verifyEmailToken flips email_verified on the stored profile", async () => {
    const identity = inMemoryIdentity({
      accounts: [{ ...aliceAccount, profile: { ...aliceAccount.profile, email_verified: false } }],
    });

    await identity.verifyEmailToken("vtok", "alice");

    expect(identity.getAccount("alice")?.profile.email_verified).toBe(true);
  });
});

describe("inMemorySession", () => {
  const fixtureIdentity = {
    token: "t",
    userId: "u",
    realm: "r",
    expiresAt: 1_700_000_000_000,
  };

  it("read returns null when empty", async () => {
    expect(await inMemorySession().read()).toBeNull();
  });

  it("write stores the identity for later read", async () => {
    const session = inMemorySession();
    await session.write(fixtureIdentity);
    expect(await session.read()).toEqual(fixtureIdentity);
  });

  it("clear removes both current session and backup", async () => {
    const session = inMemorySession({
      initial: fixtureIdentity,
      initialBackup: { ...fixtureIdentity, userId: "admin" },
    });

    await session.clear();

    expect(await session.read()).toBeNull();
    expect(await session.readBackup()).toBeNull();
  });

  it("backup operations are independent of the current session", async () => {
    const session = inMemorySession();
    const backup = { ...fixtureIdentity, userId: "admin" };

    await session.writeBackup(backup);

    expect(await session.read()).toBeNull();
    expect(await session.readBackup()).toEqual(backup);

    await session.clearBackup();

    expect(await session.readBackup()).toBeNull();
  });

  it("inspect returns the current state", async () => {
    const session = inMemorySession();
    await session.write(fixtureIdentity);

    expect(session.inspect().current).toEqual(fixtureIdentity);
    expect(session.inspect().backup).toBeNull();
  });
});
