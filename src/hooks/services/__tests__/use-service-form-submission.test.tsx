import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useServiceFormSubmission } from "../use-service-form-submission";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available to the hoisted vi.mock calls
// ---------------------------------------------------------------------------

const { mockPush, mockToast, mockSubmitServiceJob, mockDebugState } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockToast: { success: vi.fn(), error: vi.fn() },
    mockSubmitServiceJob: vi.fn(),
    mockDebugState: { isDebugMode: false, containerBuildId: "" },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("@/contexts/service-debugging-context", () => ({
  useServiceDebugging: () => mockDebugState,
}));

vi.mock("@/lib/services/service-utils", () => ({
  submitServiceJob: (...args: unknown[]) => mockSubmitServiceJob(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

interface TestFormData {
  genome: string;
  recipe: string;
}

const defaultOptions = {
  serviceName: "GenomeAssembly",
  transformParams: (data: TestFormData) => ({
    genome_id: data.genome,
    recipe: data.recipe,
  }),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useServiceFormSubmission", () => {
  beforeEach(() => {
    mockDebugState.isDebugMode = false;
    mockDebugState.containerBuildId = "";
  });

  it("returns the expected shape", () => {
    const { result } = renderHook(
      () => useServiceFormSubmission<TestFormData>(defaultOptions),
      { wrapper: createWrapper() },
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        handleSubmit: expect.any(Function),
        showParamsDialog: false,
        setShowParamsDialog: expect.any(Function),
        currentParams: expect.any(Object),
        isDebugMode: false,
        isSubmitting: false,
        serviceName: "GenomeAssembly",
      }),
    );
  });

  it("calls transformParams and submitServiceJob on submit", async () => {
    mockSubmitServiceJob.mockResolvedValue({ success: true, job: [] });

    const transformParams = vi.fn((data: TestFormData) => ({
      genome_id: data.genome,
      recipe: data.recipe,
    }));

    const { result } = renderHook(
      () =>
        useServiceFormSubmission<TestFormData>({
          ...defaultOptions,
          transformParams,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSubmit({ genome: "g1", recipe: "auto" });
    });

    expect(transformParams).toHaveBeenCalledWith({
      genome: "g1",
      recipe: "auto",
    });
    expect(mockSubmitServiceJob).toHaveBeenCalledWith("GenomeAssembly", {
      genome_id: "g1",
      recipe: "auto",
    });
  });

  it("shows a success toast on successful submission", async () => {
    mockSubmitServiceJob.mockResolvedValue({
      success: true,
      job: [{ id: "job-123" }],
    });

    const { result } = renderHook(
      () => useServiceFormSubmission<TestFormData>(defaultOptions),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSubmit({ genome: "g1", recipe: "auto" });
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      "Genome Assembly job submitted successfully!",
      expect.objectContaining({
        description: "Job ID: job-123",
        closeButton: true,
      }),
    );
  });

  it("shows an error toast on failed submission", async () => {
    mockSubmitServiceJob.mockResolvedValue({
      success: false,
      error: "Backend unavailable",
    });

    const { result } = renderHook(
      () => useServiceFormSubmission<TestFormData>(defaultOptions),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSubmit({ genome: "g1", recipe: "auto" });
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Submission failed",
        expect.objectContaining({
          description: "Backend unavailable",
          closeButton: true,
        }),
      );
    });
  });

  it("sets params dialog instead of submitting in debug mode", async () => {
    mockDebugState.isDebugMode = true;
    mockDebugState.containerBuildId = "";

    const { result } = renderHook(
      () => useServiceFormSubmission<TestFormData>(defaultOptions),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSubmit({ genome: "g1", recipe: "auto" });
    });

    expect(mockSubmitServiceJob).not.toHaveBeenCalled();
    expect(result.current.showParamsDialog).toBe(true);
    expect(result.current.currentParams).toEqual({
      genome_id: "g1",
      recipe: "auto",
    });
  });

  it("adds containerBuildId to params when set and not 'latest version'", async () => {
    mockDebugState.isDebugMode = false;
    mockDebugState.containerBuildId = "build-abc-123";
    mockSubmitServiceJob.mockResolvedValue({ success: true, job: [] });

    const { result } = renderHook(
      () => useServiceFormSubmission<TestFormData>(defaultOptions),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSubmit({ genome: "g1", recipe: "auto" });
    });

    expect(mockSubmitServiceJob).toHaveBeenCalledWith("GenomeAssembly", {
      genome_id: "g1",
      recipe: "auto",
      container_build_id: "build-abc-123",
    });
  });

  it("does not add containerBuildId when value is 'latest version'", async () => {
    mockDebugState.isDebugMode = false;
    mockDebugState.containerBuildId = "latest version";
    mockSubmitServiceJob.mockResolvedValue({ success: true, job: [] });

    const { result } = renderHook(
      () => useServiceFormSubmission<TestFormData>(defaultOptions),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSubmit({ genome: "g1", recipe: "auto" });
    });

    expect(mockSubmitServiceJob).toHaveBeenCalledWith("GenomeAssembly", {
      genome_id: "g1",
      recipe: "auto",
    });
  });
});
