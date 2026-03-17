import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";

const { mockMakeRequest } = vi.hoisted(() => ({
  mockMakeRequest: vi.fn(),
}));

vi.mock("@/lib/services/workspace/client", () => {
  return {
    WorkspaceApiClient: class {
      makeRequest = mockMakeRequest;
    },
  };
});

import { useWorkspaceDu } from "../use-workspace-du";

describe("useWorkspaceDu", () => {
  it("maps the tuple response to { sizeBytes, files, folders }", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([
      [["/user@bvbrc/home", 1024, 10, 3, ""]],
    ]);

    const { result } = renderHook(() => useWorkspaceDu("/user@bvbrc/home"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      sizeBytes: 1024,
      files: 10,
      folders: 3,
    });
  });

  it("returns zeros when the result is empty", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([[]]);

    const { result } = renderHook(() => useWorkspaceDu("/user@bvbrc/home"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      sizeBytes: 0,
      files: 0,
      folders: 0,
    });
  });

  it("returns zeros when the result is null", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue(null);

    const { result } = renderHook(() => useWorkspaceDu("/user@bvbrc/home"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      sizeBytes: 0,
      files: 0,
      folders: 0,
    });
  });

  it("is disabled when path is null", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(() => useWorkspaceDu(null), { wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("calls makeRequest with the correct params", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([
      [["/user@bvbrc/home", 500, 5, 2, ""]],
    ]);

    const { result } = renderHook(() => useWorkspaceDu("/user@bvbrc/home"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "Workspace.du",
      [{ paths: ["/user@bvbrc/home"], recursive: true, adminmode: false }],
      { silent: true },
    );
  });
});
