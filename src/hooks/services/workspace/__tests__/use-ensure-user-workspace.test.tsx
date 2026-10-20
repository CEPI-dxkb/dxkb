import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { WorkspaceApiError } from "@/lib/services/workspace/domain";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import {
  useEnsureUserWorkspace,
  type UseEnsureUserWorkspaceOptions,
} from "../use-ensure-user-workspace";

interface EndpointTracker {
  calls: number;
}

function trackEndpoint(
  respond: () => Response = () =>
    HttpResponse.json({ success: true, created: [], failures: {} }),
): EndpointTracker {
  const state: EndpointTracker = { calls: 0 };
  server.use(
    http.post("/api/auth/ensure-workspace", () => {
      state.calls += 1;
      return respond();
    }),
  );
  return state;
}

// The guard is per user for the page session, so every test uses its own user.
let userIndex = 0;
function nextUser(): string {
  userIndex += 1;
  return `user${String(userIndex)}@bvbrc`;
}

const lacksPermission = () =>
  new WorkspaceApiError(
    "_ERROR_User lacks permission to /u@bvbrc/home/_ERROR_",
    "Workspace.ls",
    { code: -32603, message: "_ERROR_User lacks permission to /u@bvbrc/home/_ERROR_" },
    500,
  );

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function renderEnsure(
  options: UseEnsureUserWorkspaceOptions,
  wrapper = createQueryClientWrapper(),
) {
  return renderHook(
    (props: UseEnsureUserWorkspaceOptions) => {
      useEnsureUserWorkspace(props);
    },
    { wrapper, initialProps: options },
  );
}

describe("useEnsureUserWorkspace", () => {
  it("does not fire when disabled", async () => {
    const tracker = trackEndpoint();

    renderEnsure({
      enabled: false,
      userKey: nextUser(),
      listError: lacksPermission(),
      homeAppearsEmpty: true,
    });

    await settle();
    expect(tracker.calls).toBe(0);
  });

  it("fires when the listing says the user lacks permission (no home yet)", async () => {
    const tracker = trackEndpoint();

    renderEnsure({
      enabled: true,
      userKey: nextUser(),
      listError: lacksPermission(),
      homeAppearsEmpty: false,
    });

    await waitFor(() => {
      expect(tracker.calls).toBe(1);
    });
  });

  it("fires when the home loaded empty", async () => {
    const tracker = trackEndpoint();

    renderEnsure({
      enabled: true,
      userKey: nextUser(),
      listError: null,
      homeAppearsEmpty: true,
    });

    await waitFor(() => {
      expect(tracker.calls).toBe(1);
    });
  });

  it.each([
    [
      "an outage",
      new WorkspaceApiError(
        "The BV-BRC workspace service did not respond (connection timed out after 10 s).",
        "Workspace.ls",
        undefined,
        504,
      ),
    ],
    ["an unrelated error", new Error("Network unreachable")],
  ])("never fires on %s, even if the home looks empty", async (_label, listError) => {
    const tracker = trackEndpoint();

    renderEnsure({
      enabled: true,
      userKey: nextUser(),
      listError,
      homeAppearsEmpty: true,
    });

    await settle();
    expect(tracker.calls).toBe(0);
  });

  it("fires at most once per user per session, across remounts and failures", async () => {
    const tracker = trackEndpoint(() =>
      HttpResponse.json({ error: "Couldn't check your workspace home folder" }, { status: 502 }),
    );
    const userKey = nextUser();
    const options = {
      enabled: true,
      userKey,
      listError: lacksPermission(),
      homeAppearsEmpty: false,
    };

    const first = renderEnsure(options);
    await waitFor(() => {
      expect(tracker.calls).toBe(1);
    });
    first.rerender({ ...options, listError: null, homeAppearsEmpty: true });
    first.unmount();

    // Coming back to home mounts the browser again, with a fresh cache.
    renderEnsure(options);
    await settle();
    expect(tracker.calls).toBe(1);

    // Another user on the same page still gets their setup.
    renderEnsure({ ...options, userKey: nextUser() });
    await waitFor(() => {
      expect(tracker.calls).toBe(2);
    });
  });

  function spyingWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    }
    return { invalidate, Wrapper };
  }

  it("does not refetch workspace queries when nothing was created", async () => {
    const tracker = trackEndpoint();
    const { invalidate, Wrapper } = spyingWrapper();

    renderEnsure(
      { enabled: true, userKey: nextUser(), listError: null, homeAppearsEmpty: true },
      Wrapper,
    );

    await waitFor(() => {
      expect(tracker.calls).toBe(1);
    });
    await settle();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("refetches workspace queries when folders were created", async () => {
    trackEndpoint(() =>
      HttpResponse.json({
        success: true,
        created: ["/u@bvbrc/home/Experiments"],
        failures: {},
      }),
    );
    const { invalidate, Wrapper } = spyingWrapper();

    renderEnsure(
      { enabled: true, userKey: nextUser(), listError: null, homeAppearsEmpty: true },
      Wrapper,
    );

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workspace"] });
    });
  });
});
