import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/services/workspace/shared", () => ({
  getWorkspaceMetadata: vi.fn(),
}));

vi.mock("@/lib/services/workspace/helpers", () => ({
  parseWorkspaceGetSingle: vi.fn(),
}));

import { useWorkspacePathResolve } from "../use-workspace-path-resolve";
import { getWorkspaceMetadata } from "@/lib/services/workspace/shared";
import { parseWorkspaceGetSingle } from "@/lib/services/workspace/helpers";

describe("useWorkspacePathResolve", () => {
  it("calls getWorkspaceMetadata and parses the result", async () => {
    const wrapper = createQueryClientWrapper();
    const rawResult = [[["myFile", "contigs", "/user/home/", "2024-01-01"]]];
    const parsed = {
      name: "myFile",
      type: "contigs",
      path: "/user/home/myFile",
      creation_time: "2024-01-01",
      id: "abc",
      owner_id: "user",
      size: 100,
      userMeta: {},
      sysMeta: {},
    };

    vi.mocked(getWorkspaceMetadata).mockResolvedValue(rawResult);
    vi.mocked(parseWorkspaceGetSingle).mockReturnValue(parsed);

    const { result } = renderHook(
      () => useWorkspacePathResolve({ fullPath: "/user/home/myFile" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getWorkspaceMetadata).toHaveBeenCalledWith(["/user/home/myFile"]);
    expect(parseWorkspaceGetSingle).toHaveBeenCalledWith(rawResult, 0);
    expect(result.current.data).toEqual(parsed);
  });

  it("returns null when parseWorkspaceGetSingle returns null", async () => {
    const wrapper = createQueryClientWrapper();
    vi.mocked(getWorkspaceMetadata).mockResolvedValue([]);
    vi.mocked(parseWorkspaceGetSingle).mockReturnValue(null);

    const { result } = renderHook(
      () => useWorkspacePathResolve({ fullPath: "/user/home/missing" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("is disabled when fullPath is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useWorkspacePathResolve({ fullPath: "" }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("is disabled when enabled is false", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspacePathResolve({
          fullPath: "/user/home/file",
          enabled: false,
        }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
