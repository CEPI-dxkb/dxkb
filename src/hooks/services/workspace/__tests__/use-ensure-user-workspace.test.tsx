import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import { useEnsureUserWorkspace } from "../use-ensure-user-workspace";

interface EndpointTracker {
  calls: number;
  install: () => void;
}

function trackEndpoint(): EndpointTracker {
  const state: EndpointTracker = {
    calls: 0,
    install() {
      server.use(
        http.post("/api/auth/ensure-workspace", () => {
          state.calls += 1;
          return HttpResponse.json({ success: true, created: [], failures: {} });
        }),
      );
    },
  };
  return state;
}

describe("useEnsureUserWorkspace", () => {
  it("does not fire when disabled", async () => {
    const tracker = trackEndpoint();
    tracker.install();

    renderHook(
      () =>
        useEnsureUserWorkspace({
          enabled: false,
          listError: new Error("_ERROR_User lacks permission"),
          homeAppearsEmpty: true,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(tracker.calls).toBe(0);
  });

  it("fires when listError contains 'User lacks permission'", async () => {
    const tracker = trackEndpoint();
    tracker.install();

    renderHook(
      () =>
        useEnsureUserWorkspace({
          enabled: true,
          listError: new Error("_ERROR_User lacks permission for /alice@bvbrc/home/"),
          homeAppearsEmpty: false,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(tracker.calls).toBe(1));
  });

  it("fires when homeAppearsEmpty is true even without an error", async () => {
    const tracker = trackEndpoint();
    tracker.install();

    renderHook(
      () =>
        useEnsureUserWorkspace({
          enabled: true,
          listError: null,
          homeAppearsEmpty: true,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(tracker.calls).toBe(1));
  });

  it("does not fire on unrelated errors", async () => {
    const tracker = trackEndpoint();
    tracker.install();

    renderHook(
      () =>
        useEnsureUserWorkspace({
          enabled: true,
          listError: new Error("Network unreachable"),
          homeAppearsEmpty: false,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(tracker.calls).toBe(0);
  });

  it("only fires once across re-renders", async () => {
    const tracker = trackEndpoint();
    tracker.install();

    interface HookProps {
      listError: Error | null;
      homeAppearsEmpty: boolean;
    }
    const initialProps: HookProps = {
      listError: new Error("_ERROR_User lacks permission"),
      homeAppearsEmpty: false,
    };
    const { rerender } = renderHook(
      (props: HookProps) =>
        useEnsureUserWorkspace({
          enabled: true,
          listError: props.listError,
          homeAppearsEmpty: props.homeAppearsEmpty,
        }),
      {
        wrapper: createQueryClientWrapper(),
        initialProps,
      },
    );

    await waitFor(() => expect(tracker.calls).toBe(1));

    rerender({
      listError: new Error("_ERROR_User lacks permission"),
      homeAppearsEmpty: true,
    });
    rerender({ listError: null, homeAppearsEmpty: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(tracker.calls).toBe(1);
  });
});
