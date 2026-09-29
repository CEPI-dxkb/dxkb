import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom doesn't ship ResizeObserver; cmdk's <Command> calls it on mount.
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
// jsdom does not ship ResizeObserver or scrollIntoView; stub both unconditionally.
globalThis.ResizeObserver = ResizeObserverStub;
// jsdom's HTMLElement.scrollIntoView is undefined; cmdk calls it when the
// active item changes.
Element.prototype.scrollIntoView = vi.fn();

const { mockPush, mockSignOut, mockAuth } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignOut: vi.fn(),
  mockAuth: {
    isAuthenticated: false,
    user: null as { username?: string; realm?: string } | null,
    status: "guest",
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/app/(auth)/redirect-action", () => ({
  signOutAndRedirect: mockSignOut,
}));

import { CommandPalette } from "../command-palette";
import { openCommandPalette } from "../command-palette-events";

function setAuth(authed: boolean, user?: { username: string; realm?: string }) {
  Object.assign(mockAuth, {
    isAuthenticated: authed,
    user: authed && user ? user : null,
    status: authed ? "authed" : "guest",
  });
}

function renderPalette() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const result = render(
    <QueryClientProvider client={queryClient}>
      <CommandPalette />
    </QueryClientProvider>,
  );

  return { ...result, invalidateSpy };
}

describe("CommandPalette", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSignOut.mockClear();
    setAuth(false);
  });

  describe("rendering", () => {
    it("renders without crashing when unauthenticated", () => {
      renderPalette();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders without crashing when authenticated", () => {
      setAuth(true, { username: "alice", realm: "bvbrc" });
      renderPalette();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("keyboard shortcut", () => {
    it("opens with Cmd+K", async () => {
      renderPalette();
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("opens with Ctrl+K", async () => {
      renderPalette();
      act(() => {
        fireEvent.keyDown(document, { key: "k", ctrlKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("toggles closed when shortcut pressed twice", async () => {
      renderPalette();
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("opens via openCommandPalette() helper", async () => {
      renderPalette();
      act(() => {
        openCommandPalette();
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("navigation items", () => {
    async function openPalette() {
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    }

    it("Home item routes to /", async () => {
      renderPalette();
      await openPalette();

      const homeItem = screen.getByRole("option", { name: /home/i });
      const user = userEvent.setup();
      await user.click(homeItem);

      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("Workspace item routes to encoded username path when authenticated", async () => {
      setAuth(true, { username: "alice", realm: "bvbrc" });
      renderPalette();
      await openPalette();

      const workspaceItem = screen.getByRole("option", { name: /workspace/i });
      const user = userEvent.setup();
      await user.click(workspaceItem);

      expect(mockPush).toHaveBeenCalledWith("/workspace/alice@bvbrc/home");
    });

    it("Jobs item routes to /jobs when authenticated", async () => {
      setAuth(true, { username: "alice", realm: "bvbrc" });
      renderPalette();
      await openPalette();

      const jobsItem = screen.getByRole("option", { name: /jobs/i });
      const user = userEvent.setup();
      await user.click(jobsItem);

      expect(mockPush).toHaveBeenCalledWith("/jobs");
    });

    it("Sign in item routes to /sign-in when unauthenticated", async () => {
      renderPalette();
      await openPalette();

      const signIn = screen.getByRole("option", { name: /sign in/i });
      const user = userEvent.setup();
      await user.click(signIn);

      expect(mockPush).toHaveBeenCalledWith("/sign-in");
    });

    it("does not show authenticated items when guest", async () => {
      renderPalette();
      await openPalette();

      expect(
        screen.queryByRole("option", { name: /^jobs$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: /sign out/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("services", () => {
    async function openPalette() {
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    }

    it("internal service item calls router.push", async () => {
      renderPalette();
      await openPalette();

      const blast = screen.getByRole("option", { name: /BLAST/ });
      const user = userEvent.setup();
      await user.click(blast);

      expect(mockPush).toHaveBeenCalledWith("/services/blast");
    });

    it("outbreak-tracker external item calls window.open instead of router.push", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      renderPalette();
      await openPalette();

      const measles = screen.getByRole("option", { name: /Measles 2025/ });
      const user = userEvent.setup();
      await user.click(measles);

      expect(openSpy).toHaveBeenCalledWith(
        "https://www.bv-brc.org/outbreaks/Measles/#view_tab=overview",
        "_blank",
        "noopener,noreferrer",
      );
      expect(mockPush).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });

  describe("search submission", () => {
    async function openPalette() {
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    }

    it("typing then selecting Search routes to /search and invalidates queries", async () => {
      const { invalidateSpy } = renderPalette();
      await openPalette();

      const input = screen.getByRole("combobox");
      const user = userEvent.setup();
      await user.type(input, "influenza");

      const searchItem = await screen.findByRole("option", {
        name: /search for/i,
      });
      await user.click(searchItem);

      expect(mockPush).toHaveBeenCalledWith(
        "/search?type=everything&q=influenza",
      );
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      const call = invalidateSpy.mock.calls[0]?.[0] as
        { predicate?: (q: { queryKey: unknown[] }) => boolean } | undefined;
      expect(call?.predicate).toBeDefined();
      expect(call?.predicate?.({ queryKey: ["genome-meta"] })).toBe(true);
      expect(call?.predicate?.({ queryKey: ["genome-full"] })).toBe(true);
      expect(call?.predicate?.({ queryKey: ["other"] })).toBe(false);
    });

    it("URL-encodes special characters in the search query", async () => {
      renderPalette();
      await openPalette();

      const input = screen.getByRole("combobox");
      const user = userEvent.setup();
      await user.type(input, "test & more");

      const searchItem = await screen.findByRole("option", {
        name: /search for/i,
      });
      await user.click(searchItem);

      expect(mockPush).toHaveBeenCalledWith(
        "/search?type=everything&q=test+%26+more",
      );
    });
  });

  describe("redesign elements", () => {
    async function openPalette() {
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    }

    it("renders ⌘K shortcut chips next to the input", async () => {
      renderPalette();
      await openPalette();

      expect(screen.getByText("⌘")).toBeInTheDocument();
      expect(screen.getByText("K")).toBeInTheDocument();
    });

    it("renders the keyboard-hint footer", async () => {
      renderPalette();
      await openPalette();

      expect(screen.getByText("Select")).toBeInTheDocument();
      expect(screen.getByText("Open")).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument();
      expect(screen.getByText("ENTER")).toBeInTheDocument();
      expect(screen.getByText("ESC")).toBeInTheDocument();
    });

    it("renders descriptions on Navigate items", async () => {
      renderPalette();
      await openPalette();

      expect(
        screen.getByText("Global dashboard and situational overview"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Access your workspace and tools"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Create a new BV-BRC account"),
      ).toBeInTheDocument();
    });
  });

  describe("sign out", () => {
    async function openPalette() {
      act(() => {
        fireEvent.keyDown(document, { key: "k", metaKey: true });
      });
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    }

    it("submits the redirecting sign-out action", async () => {
      setAuth(true, { username: "alice", realm: "bvbrc" });

      renderPalette();
      await openPalette();

      const signOut = screen.getByRole("option", { name: /sign out/i });
      const user = userEvent.setup();
      await user.click(signOut);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });
  });
});
