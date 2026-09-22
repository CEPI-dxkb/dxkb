import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ProfilePatch } from "@/lib/auth/types";

import * as authClient from "@/lib/auth/client";
import { AuthBoundary, useAuth, useAuthActions } from "@/lib/auth/provider";

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/lib/auth/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/client")>();
  return {
    ...original,
    signIn: vi.fn(),
    signUp: vi.fn(),
    startImpersonation: vi.fn(),
    exitImpersonation: vi.fn(),
    updateProfile: vi.fn(),
  };
});

const user = { id: "alice", username: "alice", email: "alice@example.test" };
const signupInput = {
  email: "alice@example.test",
  username: "alice",
  first_name: "Alice",
  last_name: "Example",
  password: "password",
  password_repeat: "password",
};

function Wrapper({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoundary user={user}>{children}</AuthBoundary>
    </QueryClientProvider>
  );
}

describe("AuthBoundary", () => {
  it("requires an AuthBoundary", () => {
    function Consumer() {
      useAuth();
      return null;
    }

    expect(() => render(<Consumer />)).toThrow(
      "useAuth must be used within <AuthBoundary>",
    );
  });

  it("exposes the server-provided user without loading state", () => {
    function Consumer() {
      const auth = useAuth();
      return (
        <span>{auth.isAuthenticated ? auth.user?.username : "guest"}</span>
      );
    }

    const queryClient = new QueryClient();
    render(<Consumer />, {
      wrapper: ({ children }) => (
        <Wrapper queryClient={queryClient}>{children}</Wrapper>
      ),
    });
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it.each([
    {
      name: "sign-in",
      setup: () => vi.mocked(authClient.signIn).mockResolvedValue(user),
      invoke: (actions: ReturnType<typeof useAuthActions>) =>
        actions.signIn({ username: "alice", password: "password" }),
      refreshes: false,
    },
    {
      name: "sign-up",
      setup: () => vi.mocked(authClient.signUp).mockResolvedValue(user),
      invoke: (actions: ReturnType<typeof useAuthActions>) =>
        actions.signUp(signupInput),
      refreshes: false,
    },
    {
      name: "start impersonation",
      setup: () =>
        vi
          .mocked(authClient.startImpersonation)
          .mockResolvedValue({ ...user, username: "bob" }),
      invoke: (actions: ReturnType<typeof useAuthActions>) =>
        actions.startImpersonation("bob", "password"),
      refreshes: true,
    },
    {
      name: "exit impersonation",
      setup: () =>
        vi.mocked(authClient.exitImpersonation).mockResolvedValue(user),
      invoke: (actions: ReturnType<typeof useAuthActions>) =>
        actions.exitImpersonation(),
      refreshes: true,
    },
  ])(
    "clears account cache after $name",
    async ({ setup, invoke, refreshes }) => {
      setup();
      const queryClient = new QueryClient();
      queryClient.setQueryData(["private"], { secret: true });
      const clearSpy = vi.spyOn(queryClient, "clear");
      const { result } = renderHook(() => useAuthActions(), {
        wrapper: ({ children }) => (
          <Wrapper queryClient={queryClient}>{children}</Wrapper>
        ),
      });

      await invoke(result.current);

      expect(clearSpy).toHaveBeenCalledOnce();
      expect(queryClient.getQueryData(["private"])).toBeUndefined();
      expect(refreshMock).toHaveBeenCalledTimes(refreshes ? 1 : 0);
    },
  );

  it("invalidates the profile and refreshes after updating it", async () => {
    vi.mocked(authClient.updateProfile).mockResolvedValue();
    const patches: ProfilePatch[] = [
      { op: "replace", path: "/first_name", value: "Alicia" },
    ];
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const clearSpy = vi.spyOn(queryClient, "clear");
    const { result } = renderHook(() => useAuthActions(), {
      wrapper: ({ children }) => (
        <Wrapper queryClient={queryClient}>{children}</Wrapper>
      ),
    });

    await result.current.updateProfile(patches);
    expect(authClient.updateProfile).toHaveBeenCalledWith(patches);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user-profile"] });
    expect(clearSpy).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("provides a guest identity without owning route policy", () => {
    function Consumer() {
      const auth = useAuth();
      return <span>{auth.isAuthenticated ? "member" : "guest"}</span>;
    }

    render(
      <AuthBoundary user={null}>
        <Consumer />
      </AuthBoundary>,
    );

    expect(screen.getByText("guest")).toBeInTheDocument();
  });
});
