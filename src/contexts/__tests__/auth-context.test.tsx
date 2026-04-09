import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ replace: mockReplace, push: vi.fn() })),
  useSearchParams: vi.fn(() => ({ toString: () => "" })),
}));

vi.mock("@/lib/auth/client", () => ({
  bvbrcAuth: {
    getSession: vi.fn(() => Promise.resolve({ data: null, error: null })),
    signOut: vi.fn(() => Promise.resolve()),
    signIn: {
      email: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    signUp: {
      email: vi.fn(() => Promise.resolve({ error: null })),
    },
    requestPasswordReset: vi.fn(() => Promise.resolve({ error: null })),
    sendVerificationEmail: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

import { usePathname } from "next/navigation";
import { bvbrcAuth } from "@/lib/auth/client";
import { AuthProvider, useAuth } from "../auth-context";

const testUser = {
  username: "testuser",
  email: "test@example.com",
  token: "abc123",
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider initialUser={testUser}>{children}</AuthProvider>
);

const noUserWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(bvbrcAuth.getSession).mockResolvedValue({ data: null, error: null } as never);
  });

  it("useAuth throws outside provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("provides initialUser when passed", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(
      expect.objectContaining({
        username: "testuser",
        email: "test@example.com",
        token: "abc123",
      }),
    );
  });

  it("isAuthenticated is true when user exists", async () => {
    vi.mocked(bvbrcAuth.getSession).mockResolvedValue({
      data: { user: testUser },
      error: null,
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
  });

  it("isAuthenticated is false when no user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
  });

  describe("signIn", () => {
    it("sets user from result.data.user on success", async () => {
      const signedInUser = { username: "signed-in", email: "s@test.com", token: "t" };
      vi.mocked(bvbrcAuth.signIn.email).mockResolvedValue({
        data: { user: signedInUser },
        error: null,
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });

      // Wait for the initial auth check to settle
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn({ username: "u", password: "p" } as never);
      });

      expect(result.current.user).toEqual(expect.objectContaining({ username: "signed-in" }));
    });

    it("falls back to fetchSession when result has no user", async () => {
      vi.mocked(bvbrcAuth.signIn.email).mockResolvedValue({
        data: {},
        error: null,
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Override after mount settles so only the signIn fallback call is counted
      vi.mocked(bvbrcAuth.getSession).mockResolvedValue({
        data: { user: { username: "session-user", email: "s@test.com", token: "t" } },
        error: null,
      } as never);
      vi.mocked(bvbrcAuth.getSession).mockClear();

      await act(async () => {
        await result.current.signIn({ username: "u", password: "p" } as never);
      });

      expect(bvbrcAuth.getSession).toHaveBeenCalledTimes(1);
      expect(result.current.user).toEqual(expect.objectContaining({ username: "session-user" }));
    });

    it("throws when result has error", async () => {
      vi.mocked(bvbrcAuth.signIn.email).mockResolvedValue({
        data: null,
        error: { message: "Invalid credentials" },
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });

      await expect(
        act(async () => {
          await result.current.signIn({ username: "u", password: "p" } as never);
        }),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("signUp", () => {
    it("fetches session and sets user on success", async () => {
      vi.mocked(bvbrcAuth.signUp.email).mockResolvedValue({ error: null } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Override after mount settles so only the signUp-triggered call is counted
      vi.mocked(bvbrcAuth.getSession).mockResolvedValue({
        data: { user: { username: "newuser", email: "n@test.com", token: "t" } },
        error: null,
      } as never);
      vi.mocked(bvbrcAuth.getSession).mockClear();

      await act(async () => {
        await result.current.signUp({ username: "u", email: "e", password: "p" } as never);
      });

      expect(bvbrcAuth.getSession).toHaveBeenCalledTimes(1);
      expect(result.current.user).toEqual(expect.objectContaining({ username: "newuser" }));
    });

    it("throws when result has error", async () => {
      vi.mocked(bvbrcAuth.signUp.email).mockResolvedValue({
        error: { message: "Email taken" },
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });

      await expect(
        act(async () => {
          await result.current.signUp({ username: "u", email: "e", password: "p" } as never);
        }),
      ).rejects.toThrow("Email taken");
    });
  });

  describe("requestPasswordReset", () => {
    it("completes without error on success", async () => {
      vi.mocked(bvbrcAuth.requestPasswordReset).mockResolvedValue({ error: null } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });

      await act(async () => {
        await result.current.requestPasswordReset("user@test.com");
      });

      expect(bvbrcAuth.requestPasswordReset).toHaveBeenCalledWith({ usernameOrEmail: "user@test.com" });
    });

    it("throws when result has error", async () => {
      vi.mocked(bvbrcAuth.requestPasswordReset).mockResolvedValue({
        error: { message: "User not found" },
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper: noUserWrapper });

      await expect(
        act(async () => {
          await result.current.requestPasswordReset("unknown@test.com");
        }),
      ).rejects.toThrow("User not found");
    });
  });

  describe("sendVerificationEmail", () => {
    it("completes without throwing on success", async () => {
      vi.mocked(bvbrcAuth.sendVerificationEmail).mockResolvedValue({ error: null } as never);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.sendVerificationEmail();
      });

      expect(bvbrcAuth.sendVerificationEmail).toHaveBeenCalled();
    });

    it("logs error but does not throw on failure", async () => {
      vi.mocked(bvbrcAuth.sendVerificationEmail).mockResolvedValue({
        error: { message: "Send failed" },
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.sendVerificationEmail();
      });

      expect(console.error).toHaveBeenCalledWith(
        "Failed to send verification email:",
        "Send failed",
      );
    });
  });

  describe("refreshAuth", () => {
    it("calls signOut when session returns null user", async () => {
      vi.mocked(bvbrcAuth.getSession).mockResolvedValue({
        data: null,
        error: null,
      } as never);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(bvbrcAuth.signOut).toHaveBeenCalled();
    });

    it("calls signOut when session fetch throws", async () => {
      vi.mocked(bvbrcAuth.getSession).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(bvbrcAuth.signOut).toHaveBeenCalled();
    });
  });

  describe("protected route redirect", () => {
    it("redirects to sign-in when user is null on protected path", async () => {
      vi.mocked(usePathname).mockReturnValue("/services/blast");

      renderHook(() => useAuth(), { wrapper: noUserWrapper });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          "/sign-in?redirect=%2Fservices%2Fblast",
        );
      });
    });
  });
});
