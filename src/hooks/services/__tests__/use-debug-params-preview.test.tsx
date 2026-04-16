import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

import { useDebugParamsPreview } from "@/hooks/services/use-debug-params-preview";
import {
  ServiceDebuggingProvider,
  useServiceDebugging,
} from "@/contexts/service-debugging-context";

interface DebugSetters {
  setIsDebugMode: (v: boolean) => void;
  setContainerBuildId: (v: string) => void;
}

const noopSetters: DebugSetters = {
  setIsDebugMode: () => {
    throw new Error("setters captured before ready — await capture.ready first");
  },
  setContainerBuildId: () => {
    throw new Error("setters captured before ready — await capture.ready first");
  },
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <ServiceDebuggingProvider>{children}</ServiceDebuggingProvider>;
}

// Renders a child that exposes the debugging setters via onReady.
function DebugToggler({ onReady }: { onReady: (setters: DebugSetters) => void }) {
  const { setIsDebugMode, setContainerBuildId } = useServiceDebugging();
  React.useEffect(() => {
    onReady({ setIsDebugMode, setContainerBuildId });
  }, [setIsDebugMode, setContainerBuildId, onReady]);
  return null;
}

function wrapperWithToggle(capture: { current: DebugSetters; ready: boolean }) {
  return function WrapperWithToggle({ children }: { children: React.ReactNode }) {
    return (
      <ServiceDebuggingProvider>
        <DebugToggler
          onReady={(s) => {
            capture.current = s;
            capture.ready = true;
          }}
        />
        {children}
      </ServiceDebuggingProvider>
    );
  };
}

describe("useDebugParamsPreview", () => {
  it("calls submit with unchanged params when debug off and no containerBuildId", async () => {
    const submit = vi.fn(async () => undefined);
    const { result } = renderHook(
      () => useDebugParamsPreview({ serviceName: "GenomeAssembly2" }),
      { wrapper },
    );

    await act(async () => {
      await result.current.previewOrPassthrough({ foo: "bar" }, submit);
    });

    expect(submit).toHaveBeenCalledWith({ foo: "bar" });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('merges container_build_id when set and not "latest version"', async () => {
    const capture = { current: noopSetters, ready: false };
    const { result } = renderHook(
      () => useDebugParamsPreview({ serviceName: "GenomeAssembly2" }),
      { wrapper: wrapperWithToggle(capture) },
    );

    await waitFor(() => expect(capture.ready).toBe(true));
    act(() => capture.current.setContainerBuildId("build-42"));

    const submit = vi.fn(async () => undefined);
    await act(async () => {
      await result.current.previewOrPassthrough({ foo: "bar" }, submit);
    });

    expect(submit).toHaveBeenCalledWith({ foo: "bar", container_build_id: "build-42" });
  });

  it('does NOT merge container_build_id when set to "latest version"', async () => {
    const capture = { current: noopSetters, ready: false };
    const { result } = renderHook(
      () => useDebugParamsPreview({ serviceName: "GenomeAssembly2" }),
      { wrapper: wrapperWithToggle(capture) },
    );

    await waitFor(() => expect(capture.ready).toBe(true));
    act(() => capture.current.setContainerBuildId("latest version"));

    const submit = vi.fn(async () => undefined);
    await act(async () => {
      await result.current.previewOrPassthrough({ foo: "bar" }, submit);
    });

    expect(submit).toHaveBeenCalledWith({ foo: "bar" });
  });

  it("opens dialog with merged params when debug mode is on; does not call submit", async () => {
    const capture = { current: noopSetters, ready: false };
    const { result } = renderHook(
      () => useDebugParamsPreview({ serviceName: "GenomeAssembly2" }),
      { wrapper: wrapperWithToggle(capture) },
    );

    await waitFor(() => expect(capture.ready).toBe(true));
    act(() => capture.current.setIsDebugMode(true));

    const submit = vi.fn(async () => undefined);
    await act(async () => {
      await result.current.previewOrPassthrough({ foo: "bar" }, submit);
    });

    expect(submit).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.params).toEqual({ foo: "bar" });
    expect(result.current.dialogProps.serviceName).toBe("GenomeAssembly2");
  });
});
