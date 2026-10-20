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
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
        }),
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
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit({});
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("keeps a submit timeout on screen with a way to check Jobs", async () => {
    const { toast } = await import("sonner");
    const message =
      "The BV-BRC job service did not respond within 30 s. Your job may still have been queued: check Jobs before you submit it again.";
    server.use(
      http.post("*/api/services/app-service/submit", () =>
        HttpResponse.json({ error: message, code: "upstream" }, { status: 504 }),
      ),
    );

    const { result } = renderHook(
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit({});
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "The job service did not respond",
        expect.objectContaining({
          description: message,
          duration: Infinity,
          action: expect.objectContaining({ label: "View Jobs" }) as unknown,
        }),
      );
    });
  });

  it.each([
    // A 504 toast stays until dismissed, so it must not hold a page of text.
    { status: 504, title: "The job service did not respond", duration: Infinity },
    { status: 500, title: "Submission failed", duration: undefined },
  ])(
    "condenses a long $status failure in its toast, as inline",
    async ({ status, title, duration }) => {
      const { toast } = await import("sonner");
      const toastError = toast.error as ReturnType<typeof vi.fn>;
      toastError.mockClear();
      server.use(
        http.post("*/api/services/app-service/submit", () =>
          HttpResponse.json({ error: "x".repeat(1000) }, { status }),
        ),
      );

      const { result } = renderHook(
        () =>
          useServiceFormSubmission({
            serviceName: "GenomeAssembly2",
            displayName: "Genome Assembly",
          }),
        { wrapper },
      );

      await act(async () => {
        await result.current.submit({});
      });

      await waitFor(() => {
        expect(toastError).toHaveBeenCalledTimes(1);
      });
      const [toastTitle, options] = toastError.mock.calls[0] as [
        string,
        { description: string; duration?: number },
      ];
      expect(toastTitle).toBe(title);
      expect(options.description.length).toBeLessThanOrEqual(301);
      expect(options.description.endsWith("…")).toBe(true);
      expect(options.description).toBe(result.current.submitError?.message);
      expect(options.duration).toBe(duration);
    },
  );

  it("exposes the real failure as submitError and clears it on the next submit", async () => {
    let attempt = 0;
    server.use(
      http.post("*/api/services/app-service/submit", () => {
        attempt += 1;
        return attempt === 1
          ? HttpResponse.json(
              { error: "JSON-RPC call failed: fetch failed", code: "upstream" },
              { status: 502 },
            )
          : HttpResponse.json({ job: [{ id: "job-9" }] });
      }),
    );

    const { result } = renderHook(
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
        }),
      { wrapper },
    );
    expect(result.current.submitError).toBeNull();

    await act(async () => {
      await result.current.submit({});
    });
    await waitFor(() => {
      expect(result.current.submitError).toEqual({
        title: "Submission failed",
        message: "JSON-RPC call failed: fetch failed",
        mayHaveBeenQueued: false,
      });
    });

    await act(async () => {
      await result.current.submit({});
    });
    await waitFor(() => {
      expect(result.current.submitError).toBeNull();
    });
  });

  it("marks a 504 submitError as possibly queued", async () => {
    server.use(
      http.post("*/api/services/app-service/submit", () =>
        HttpResponse.json(
          { error: "The BV-BRC job service did not respond within 30 s." },
          { status: 504 },
        ),
      ),
    );

    const { result } = renderHook(
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit({});
    });
    await waitFor(() => {
      expect(result.current.submitError).toEqual(
        expect.objectContaining({
          title: "The job service did not respond",
          mayHaveBeenQueued: true,
        }),
      );
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
      () =>
        useServiceFormSubmission({
          serviceName: "GenomeAssembly2",
          displayName: "Genome Assembly",
        }),
      { wrapper },
    );

    const promise = act(async () => {
      await result.current.submit({});
    });

    await waitFor(() => { expect(result.current.isSubmitting).toBe(true); });
    resolve();
    await promise;
    await waitFor(() => { expect(result.current.isSubmitting).toBe(false); });
  });
});
