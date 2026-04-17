import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import {
  ServiceDebuggingProvider,
  useServiceDebugging,
} from "@/contexts/service-debugging-context";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { createServiceDefinition } from "@/lib/services/service-definition";
import { server } from "@/test-helpers/msw-server";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

interface ExampleFormData {
  output_path: string;
  output_file: string;
  flag: boolean;
}

interface DebugSetters {
  setIsDebugMode: (v: boolean) => void;
  setContainerBuildId: (v: string) => void;
}

const noopSetters: DebugSetters = {
  setIsDebugMode: () => {
    throw new Error("setters captured before ready");
  },
  setContainerBuildId: () => {
    throw new Error("setters captured before ready");
  },
};

const exampleDefinition = createServiceDefinition<ExampleFormData>({
  serviceName: "GenomeAssembly2",
  displayName: "Genome Assembly",
  schema: null,
  defaultValues: { output_path: "", output_file: "", flag: false },
  transformParams: (data) => ({
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    flag: data.flag ? "true" : "false",
  }),
  rerun: {
    fields: ["output_path", "output_file"],
    defaultOutputPath: null,
  },
});

const defaultPathDefinition = createServiceDefinition<ExampleFormData>({
  serviceName: "GenomeAssembly2",
  displayName: "Genome Assembly",
  schema: null,
  defaultValues: { output_path: "", output_file: "", flag: false },
  transformParams: (data) => ({
    output_path: data.output_path,
    output_file: data.output_file.trim(),
    flag: data.flag ? "true" : "false",
  }),
  rerun: {
    fields: ["output_path", "output_file"],
  },
});

function makeForm() {
  const values: Record<string, unknown> = {};
  return {
    getFieldValue: vi.fn((field: string) => values[field]),
    setFieldValue: vi.fn((field: string, value: unknown) => {
      values[field] = value;
    }),
    _values: values,
  };
}

function DebugToggler({ onReady }: { onReady: (setters: DebugSetters) => void }) {
  const { setIsDebugMode, setContainerBuildId } = useServiceDebugging();
  React.useEffect(() => {
    onReady({ setIsDebugMode, setContainerBuildId });
  }, [setIsDebugMode, setContainerBuildId, onReady]);
  return null;
}

function wrapper(capture?: { current: DebugSetters; ready: boolean }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ServiceDebuggingProvider>
          {capture ? (
            <DebugToggler
              onReady={(setters) => {
                capture.current = setters;
                capture.ready = true;
              }}
            />
          ) : null}
          {children}
        </ServiceDebuggingProvider>
      </QueryClientProvider>
    );
  };
}

function setRerunSession(key: string, payload: Record<string, unknown>) {
  sessionStorage.setItem(key, JSON.stringify(payload));
  window.history.replaceState({}, "", `/?rerun_key=${key}`);
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("useServiceRuntime", () => {
  it("submits transformed form data through the service submit endpoint", async () => {
    let captured: unknown = null;
    server.use(
      http.post("*/api/services/app-service/submit", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ job: [{ id: "job-123" }] });
      }),
    );

    const form = makeForm();
    const { result } = renderHook(
      () =>
        useServiceRuntime({
          definition: exampleDefinition,
          form,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.submitFormData({
        output_path: "/ws/out",
        output_file: " result ",
        flag: true,
      });
    });

    expect(captured).toMatchObject({
      app_name: "GenomeAssembly2",
      app_params: {
        output_path: "/ws/out",
        output_file: "result",
        flag: "true",
      },
    });
  });

  it("applies rerun fields through the definition rerun config", async () => {
    setRerunSession("rerun-1", {
      output_path: "/ws/rerun",
      output_file: "rerun-output",
    });
    const form = makeForm();

    renderHook(
      () =>
        useServiceRuntime({
          definition: exampleDefinition,
          form,
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledWith(
        "output_path",
        "/ws/rerun",
      );
      expect(form.setFieldValue).toHaveBeenCalledWith(
        "output_file",
        "rerun-output",
      );
    });
  });

  it("preserves call-site default-output-path opt out", async () => {
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json({
          settings: { default_job_folder: "/ws/default" },
        }),
      ),
    );
    const form = makeForm();

    renderHook(
      () =>
        useServiceRuntime({
          definition: defaultPathDefinition,
          form,
          rerun: { defaultOutputPath: null },
        }),
      { wrapper: wrapper() },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(form.setFieldValue).not.toHaveBeenCalledWith(
      "output_path",
      "/ws/default",
    );
  });

  it("routes debug mode through the job params dialog without submitting", async () => {
    const capture = { current: noopSetters, ready: false };
    const submitSpy = vi.fn();
    server.use(
      http.post("*/api/services/app-service/submit", async () => {
        submitSpy();
        return HttpResponse.json({ job: [{ id: "job-123" }] });
      }),
    );
    const form = makeForm();
    const { result } = renderHook(
      () =>
        useServiceRuntime({
          definition: exampleDefinition,
          form,
        }),
      { wrapper: wrapper(capture) },
    );

    await waitFor(() => expect(capture.ready).toBe(true));
    act(() => {
      capture.current.setIsDebugMode(true);
      capture.current.setContainerBuildId("build-42");
    });

    await act(async () => {
      await result.current.submitFormData({
        output_path: "/ws/out",
        output_file: "result",
        flag: false,
      });
    });

    expect(submitSpy).not.toHaveBeenCalled();
    expect(result.current.jobParamsDialogProps).toMatchObject({
      open: true,
      serviceName: "GenomeAssembly2",
      params: {
        output_path: "/ws/out",
        output_file: "result",
        flag: "false",
        container_build_id: "build-42",
      },
    });
  });
});
