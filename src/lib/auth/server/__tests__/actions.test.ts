const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  registerUser: vi.fn(),
  getProfile: vi.fn(),
  impersonateUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  sendVerificationEmail: vi.fn(),
  verifyEmailToken: vi.fn(),
  changePassword: vi.fn(),
  readSession: vi.fn(),
  writeSession: vi.fn(),
  clearCurrentSession: vi.fn(),
  clearBackup: vi.fn(),
  clearSession: vi.fn(),
  readBackup: vi.fn(),
  writeBackup: vi.fn(),
  restoreBackup: vi.fn(),
  ensureUserWorkspace: vi.fn(),
  createServerWorkspaceRpc: vi.fn(),
}));

vi.mock("../adapters/bvbrc-identity", () => ({
  authenticate: mocks.authenticate,
  registerUser: mocks.registerUser,
  getProfile: mocks.getProfile,
  impersonateUser: mocks.impersonateUser,
  extractRealmFromToken: () => "realm",
  requestPasswordReset: mocks.requestPasswordReset,
  sendVerificationEmail: mocks.sendVerificationEmail,
  verifyEmailToken: mocks.verifyEmailToken,
  changePassword: mocks.changePassword,
}));
vi.mock("../session", () => ({
  readSession: mocks.readSession,
  writeSession: mocks.writeSession,
  clearCurrentSession: mocks.clearCurrentSession,
  clearImpersonationBackup: mocks.clearBackup,
  clearSession: mocks.clearSession,
  readImpersonationBackup: mocks.readBackup,
  writeImpersonationBackup: mocks.writeBackup,
  restoreImpersonationBackup: mocks.restoreBackup,
}));
vi.mock("@/lib/services/workspace/setup", () => ({
  ensureUserWorkspace: mocks.ensureUserWorkspace,
}));
vi.mock("@/lib/services/workspace/server-rpc", () => ({
  createServerWorkspaceRpc: mocks.createServerWorkspaceRpc,
}));

import {
  changePassword,
  exitImpersonation,
  getCurrentUser,
  requestPasswordReset,
  sendVerificationEmail,
  signIn,
  signOut,
  signUp,
  startImpersonation,
  verifyEmailToken,
} from "../actions";
import type { UserProfile } from "@/lib/auth/types";

const outage = () => ({
  code: "service_unavailable" as const,
  message: "down",
  status: 503,
});
const unauthorized = () => ({
  code: "unauthorized" as const,
  message: "expired",
  status: 401,
});

const profile = (partial: Partial<UserProfile> = {}): UserProfile => ({
  id: "canonical-id",
  l_id: "alice",
  email: "alice@example.com",
  email_verified: true,
  first_name: "Alice",
  last_name: "User",
  creation_date: "",
  last_login: "",
  organisms: "",
  reverification: false,
  source: "test",
  ...partial,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readBackup.mockResolvedValue(null);
});

describe("auth actions", () => {
  it("validates profile before writing and stores its canonical id", async () => {
    mocks.authenticate.mockResolvedValue({ data: { token: "t" }, error: null });
    mocks.getProfile.mockResolvedValue({ data: profile(), error: null });
    mocks.writeSession.mockResolvedValue(1234);
    const result = await signIn({ username: "submitted", password: "pw" });
    expect(mocks.getProfile).toHaveBeenCalledWith("submitted", "t");
    expect(mocks.writeSession).toHaveBeenCalledWith({
      token: "t",
      userId: "canonical-id",
      realm: "realm",
    });
    expect(result.data?.expiresAt).toBe(1234);
    expect(result.data?.user).toMatchObject({
      id: "canonical-id",
      username: "alice",
    });
    expect(result.data?.user).not.toHaveProperty("token");
  });

  it("does not create a partial session during profile outage", async () => {
    mocks.authenticate.mockResolvedValue({ data: { token: "t" }, error: null });
    mocks.getProfile.mockResolvedValue({
      data: null,
      error: { code: "service_unavailable", message: "down", status: 503 },
    });
    expect((await signIn({ username: "u", password: "p" })).error?.code).toBe(
      "service_unavailable",
    );
    expect(mocks.writeSession).not.toHaveBeenCalled();
  });

  it("rejects nested impersonation before touching the current session", async () => {
    mocks.readBackup.mockResolvedValue({ token: "original", userId: "admin" });
    const result = await startImpersonation("target", "pw");
    expect(result.error).toMatchObject({ code: "conflict", status: 409 });
    expect(mocks.readSession).not.toHaveBeenCalled();
  });

  it("resolves the target canonical id before switching cookies", async () => {
    const admin = { token: "admin-token", userId: "admin-id" };
    mocks.readSession.mockResolvedValue(admin);
    mocks.getProfile
      .mockResolvedValueOnce({
        data: profile({ id: "admin-id", roles: ["admin"] }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: profile({ id: "target-id", l_id: "target" }),
        error: null,
      });
    mocks.impersonateUser.mockResolvedValue({
      data: { token: "target-token" },
      error: null,
    });
    mocks.writeSession.mockResolvedValue(999);
    await startImpersonation("submitted-target", "pw");
    expect(mocks.getProfile).toHaveBeenLastCalledWith(
      "submitted-target",
      "target-token",
    );
    expect(mocks.writeBackup).toHaveBeenCalledWith(admin);
    expect(mocks.writeSession).toHaveBeenCalledWith({
      token: "target-token",
      userId: "target-id",
      realm: "realm",
    });
    expect(mocks.writeBackup.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.writeSession.mock.invocationCallOrder[0],
    );
  });

  it.each([
    { provisioned: true, workspaceError: undefined },
    { provisioned: false, workspaceError: new Error("workspace down") },
  ])(
    "signs up with canonical identity when workspace provisioned=$provisioned",
    async ({ workspaceError }) => {
      const rpc = { call: vi.fn() };
      mocks.registerUser.mockResolvedValue({
        data: { token: "signup-token" },
        error: null,
      });
      mocks.getProfile.mockResolvedValue({ data: profile(), error: null });
      mocks.writeSession.mockResolvedValue(2345);
      mocks.createServerWorkspaceRpc.mockReturnValue(rpc);
      if (workspaceError) {
        mocks.ensureUserWorkspace.mockRejectedValue(workspaceError);
      } else {
        mocks.ensureUserWorkspace.mockResolvedValue(undefined);
      }
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const result = await signUp({
        username: "submitted",
        email: "alice@example.com",
        first_name: "Alice",
        last_name: "User",
        password: "pw",
        password_repeat: "pw",
      });

      expect(mocks.getProfile).toHaveBeenCalledWith(
        "submitted",
        "signup-token",
      );
      expect(mocks.writeSession).toHaveBeenCalledWith({
        token: "signup-token",
        userId: "canonical-id",
        realm: "realm",
      });
      expect(mocks.createServerWorkspaceRpc).toHaveBeenCalledWith(
        "signup-token",
      );
      expect(mocks.ensureUserWorkspace).toHaveBeenCalledWith({
        rpc,
        userId: "canonical-id",
        realm: "realm",
      });
      expect(result).toMatchObject({
        data: {
          expiresAt: 2345,
          user: { id: "canonical-id", username: "alice" },
        },
        error: null,
      });
      expect(consoleError).toHaveBeenCalledTimes(workspaceError ? 1 : 0);
      consoleError.mockRestore();
    },
  );

  it("signs out by clearing the current session and SU backup together", async () => {
    await expect(signOut()).resolves.toEqual({ data: undefined, error: null });
    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "target token failure",
      impersonated: { data: null, error: unauthorized() },
      targetProfile: undefined,
      code: "unauthorized",
    },
    {
      name: "target profile failure",
      impersonated: { data: { token: "target-token" }, error: null },
      targetProfile: { data: null, error: outage() },
      code: "service_unavailable",
    },
  ])("preserves the admin session and backup on $name", async (testCase) => {
    mocks.readSession.mockResolvedValue({
      token: "admin-token",
      userId: "admin",
    });
    mocks.getProfile.mockResolvedValueOnce({
      data: profile({ id: "admin", roles: ["admin"] }),
      error: null,
    });
    mocks.impersonateUser.mockResolvedValue(testCase.impersonated);
    if (testCase.targetProfile) {
      mocks.getProfile.mockResolvedValueOnce(testCase.targetProfile);
    }

    expect((await startImpersonation("target", "pw")).error?.code).toBe(
      testCase.code,
    );
    expect(mocks.writeBackup).not.toHaveBeenCalled();
    expect(mocks.writeSession).not.toHaveBeenCalled();
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
  });

  it("marks a missing admin session as expired", async () => {
    mocks.readSession.mockResolvedValue(null);
    await expect(startImpersonation("target", "pw")).resolves.toMatchObject({
      data: null,
      error: { code: "unauthorized", sessionExpired: true },
    });
  });

  it("marks only a rejected admin session as expired", async () => {
    mocks.readSession.mockResolvedValue({
      token: "admin-token",
      userId: "admin",
    });
    mocks.getProfile.mockResolvedValue({
      data: null,
      error: { ...unauthorized() },
    });

    await expect(startImpersonation("target", "pw")).resolves.toMatchObject({
      data: null,
      error: { code: "unauthorized", sessionExpired: true },
    });
    expect(mocks.clearCurrentSession).toHaveBeenCalledOnce();
  });

  it("propagates an admin profile outage without clearing the session", async () => {
    mocks.readSession.mockResolvedValue({
      token: "admin-token",
      userId: "admin",
    });
    mocks.getProfile.mockResolvedValue({ data: null, error: outage() });

    await expect(startImpersonation("target", "pw")).resolves.toEqual({
      data: null,
      error: outage(),
    });
    expect(mocks.impersonateUser).not.toHaveBeenCalled();
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
  });

  it("clears the SU backup when switching the active session fails", async () => {
    const admin = { token: "admin-token", userId: "admin-id" };
    mocks.readSession.mockResolvedValue(admin);
    mocks.getProfile
      .mockResolvedValueOnce({
        data: profile({ id: "admin-id", roles: ["admin"] }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: profile({ id: "target-id", l_id: "target" }),
        error: null,
      });
    mocks.impersonateUser.mockResolvedValue({
      data: { token: "target-token" },
      error: null,
    });
    mocks.writeSession.mockRejectedValue(new Error("cookie write failed"));

    await expect(startImpersonation("target", "pw")).rejects.toThrow(
      "cookie write failed",
    );
    expect(mocks.writeBackup).toHaveBeenCalledWith(admin);
    expect(mocks.clearBackup).toHaveBeenCalledOnce();
  });

  it("validates recovery before atomically restoring the SU backup", async () => {
    const backup = { token: "admin-token", userId: "admin", realm: "realm" };
    mocks.readBackup.mockResolvedValue(backup);
    mocks.getProfile.mockResolvedValue({
      data: profile({ id: "admin", l_id: "admin", roles: ["admin"] }),
      error: null,
    });
    mocks.restoreBackup.mockResolvedValue(4567);

    await expect(exitImpersonation()).resolves.toMatchObject({
      data: { expiresAt: 4567, user: { id: "admin", username: "admin" } },
      error: null,
    });
    expect(mocks.getProfile).toHaveBeenCalledWith("admin", "admin-token");
    expect(mocks.getProfile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.restoreBackup.mock.invocationCallOrder[0],
    );
  });

  it("preserves the SU backup when recovery profile lookup fails", async () => {
    mocks.readBackup.mockResolvedValue({
      token: "admin-token",
      userId: "admin",
    });
    mocks.getProfile.mockResolvedValue({ data: null, error: outage() });

    await expect(exitImpersonation()).resolves.toEqual({
      data: null,
      error: outage(),
    });
    expect(mocks.restoreBackup).not.toHaveBeenCalled();
  });

  it("treats an unauthorized profile read as signed out", async () => {
    mocks.readSession.mockResolvedValue({
      token: "token",
      userId: "canonical-id",
    });
    mocks.getProfile.mockResolvedValue({ data: null, error: unauthorized() });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
    expect(mocks.clearSession).not.toHaveBeenCalled();
  });

  it("keeps the session user signed in, unverified, during a profile outage", async () => {
    mocks.readSession.mockResolvedValue({
      token: "token",
      userId: "canonical-id",
      realm: "realm",
    });
    mocks.getProfile.mockResolvedValue({ data: null, error: outage() });

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: "canonical-id",
      realm: "realm",
      sessionUnverified: true,
    });
    expect(mocks.getProfile).toHaveBeenCalledWith("canonical-id", "token", {
      timeoutMs: 5_000,
    });
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
    expect(mocks.clearSession).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "password reset",
      invoke: () => requestPasswordReset("alice@example.com"),
      adapter: mocks.requestPasswordReset,
      args: ["alice@example.com"],
    },
    {
      name: "email token verification",
      invoke: () => verifyEmailToken("verification-token", "alice"),
      adapter: mocks.verifyEmailToken,
      args: ["verification-token", "alice"],
    },
  ])("delegates $name without touching session state", async (testCase) => {
    testCase.adapter.mockResolvedValue({ data: undefined, error: null });

    await expect(testCase.invoke()).resolves.toEqual({
      data: undefined,
      error: null,
    });
    expect(testCase.adapter).toHaveBeenCalledWith(...testCase.args);
    expect(mocks.readSession).not.toHaveBeenCalled();
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "verification email",
      invoke: () => sendVerificationEmail(),
      adapter: mocks.sendVerificationEmail,
      args: ["canonical-id", "token"],
    },
    {
      name: "password change",
      invoke: () => changePassword("old", "new"),
      adapter: mocks.changePassword,
      args: ["canonical-id", "token", "old", "new"],
    },
  ])(
    "delegates $name and clears only an unauthorized current session",
    async (testCase) => {
      mocks.readSession.mockResolvedValue({
        token: "token",
        userId: "canonical-id",
      });
      testCase.adapter.mockResolvedValue({ data: null, error: unauthorized() });

      await expect(testCase.invoke()).resolves.toEqual({
        data: null,
        error: unauthorized(),
      });
      expect(testCase.adapter).toHaveBeenCalledWith(...testCase.args);
      expect(mocks.clearCurrentSession).toHaveBeenCalledOnce();
      expect(mocks.clearSession).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      invoke: () => sendVerificationEmail(),
      adapter: mocks.sendVerificationEmail,
    },
    {
      invoke: () => changePassword("old", "new"),
      adapter: mocks.changePassword,
    },
  ])("preserves the current session on delegated outages", async (testCase) => {
    mocks.readSession.mockResolvedValue({
      token: "token",
      userId: "canonical-id",
    });
    testCase.adapter.mockResolvedValue({ data: null, error: outage() });

    await expect(testCase.invoke()).resolves.toEqual({
      data: null,
      error: outage(),
    });
    expect(mocks.clearCurrentSession).not.toHaveBeenCalled();
  });
});
