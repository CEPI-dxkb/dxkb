import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React from "react";

import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { server } from "@/test-helpers/msw-server";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useServiceFormSubmission", () => {
  it("posts params to /api/services/app-service/submit and resolves", async () => {
    let captured: unknown = null;
    server.use(
      http.post("*/api/services/app-service/submit", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ job: [{ id: "job-123" }] });
      }),
    );

    const { result } = renderHook(
      () => useServiceFormSubmission({ serviceName: "GenomeAssembly2" }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit({ recipe: "spades", output_path: "/ws" });
    });

    expect(captured).toMatchObject({
      app_name: "GenomeAssembly2",
      app_params: { recipe: "spades", output_path: "/ws" },
    });
  });

  it("fires success toast with jobId and calls onSuccess", async () => {
    const { toast } = await import("sonner");
    server.use(
      http.post("*/api/services/app-service/submit", () =>
        HttpResponse.json({ job: [{ id: "job-456" }] }),
      ),
    );
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
          onSuccess,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit({});
    });

    expect(toast.success).toHaveBeenCalled();
    const call = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1]).toMatchObject({ description: "Job ID: job-456" });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("fires error toast on failure and does not throw", async () => {
    const { toast } = await import("sonner");
    server.use(
      http.post("*/api/services/app-service/submit", () =>
        HttpResponse.json({ error: "bad params" }, { status: 400 }),
      ),
    );

    const { result } = renderHook(
      () => useServiceFormSubmission({ serviceName: "GenomeAssembly2" }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit({});
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("tracks isSubmitting during pending submission", async () => {
    let resolve!: () => void;
    const blocker = new Promise<void>((r) => {
      resolve = r;
    });
    server.use(
      http.post("*/api/services/app-service/submit", async () => {
        await blocker;
        return HttpResponse.json({ job: [{ id: "job-1" }] });
      }),
    );

    const { result } = renderHook(
      () => useServiceFormSubmission({ serviceName: "GenomeAssembly2" }),
      { wrapper },
    );

    const promise = act(async () => {
      await result.current.submit({});
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    resolve();
    await promise;
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });
});
