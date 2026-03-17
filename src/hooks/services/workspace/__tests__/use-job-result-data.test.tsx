import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

vi.mock("@/lib/services/workspace/shared", () => ({
  getWorkspaceMetadata: vi.fn(),
}));

vi.mock("@/lib/services/workspace/helpers", () => ({
  getJobResultDotPath: vi.fn(),
  parseWorkspaceGetSingle: vi.fn(),
}));

import { useJobResultData } from "../use-job-result-data";
import { getWorkspaceMetadata } from "@/lib/services/workspace/shared";
import {
  getJobResultDotPath,
  parseWorkspaceGetSingle,
} from "@/lib/services/workspace/helpers";

const makeResolvedMeta = (
  overrides: Partial<ResolvedPathObject> = {},
): ResolvedPathObject => ({
  name: "myJob",
  type: "job_result",
  path: "/user@bvbrc/home/myJob",
  creation_time: "2024-01-01",
  id: "abc123",
  owner_id: "user",
  size: 0,
  userMeta: {},
  sysMeta: {},
  ...overrides,
});

describe("useJobResultData", () => {
  it("computes dotPath from getJobResultDotPath", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const wrapper = createQueryClientWrapper();
    const meta = makeResolvedMeta();
    vi.mocked(getJobResultDotPath).mockReturnValue("/user@bvbrc/home/.myJob");

    const { result } = renderHook(
      () => useJobResultData({ resolvedJobMeta: meta }),
      { wrapper },
    );

    expect(getJobResultDotPath).toHaveBeenCalledWith(meta);
    expect(result.current.dotPath).toBe("/user@bvbrc/home/.myJob");
  });

  it("returns empty dotPath when resolvedJobMeta is null", () => {
    const wrapper = createQueryClientWrapper();

    const { result } = renderHook(
      () => useJobResultData({ resolvedJobMeta: null }),
      { wrapper },
    );

    expect(getJobResultDotPath).not.toHaveBeenCalled();
    expect(result.current.dotPath).toBe("");
  });

  it("fetches metadata using the computed dotPath", async () => {
    const wrapper = createQueryClientWrapper();
    const meta = makeResolvedMeta();
    const dotPath = "/user@bvbrc/home/.myJob";
    const rawResult = [[["dotFolder", "folder", "/user@bvbrc/home/"]]];
    const parsedDotMeta = makeResolvedMeta({
      name: ".myJob",
      type: "folder",
      path: dotPath,
    });

    vi.mocked(getJobResultDotPath).mockReturnValue(dotPath);
    vi.mocked(getWorkspaceMetadata).mockResolvedValue(rawResult);
    vi.mocked(parseWorkspaceGetSingle).mockReturnValue(parsedDotMeta);

    const { result } = renderHook(
      () => useJobResultData({ resolvedJobMeta: meta }),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.dotMetaQuery.isSuccess).toBe(true),
    );

    expect(getWorkspaceMetadata).toHaveBeenCalledWith([dotPath]);
    expect(parseWorkspaceGetSingle).toHaveBeenCalledWith(rawResult, 0);
    expect(result.current.dotMeta).toEqual(parsedDotMeta);
  });

  it("does not fetch when dotPath is empty (resolvedJobMeta null)", () => {
    const wrapper = createQueryClientWrapper();

    const { result } = renderHook(
      () => useJobResultData({ resolvedJobMeta: null }),
      { wrapper },
    );

    expect(result.current.dotMetaQuery.isFetching).toBe(false);
    expect(result.current.dotMeta).toBeNull();
  });

  it("does not fetch when enabled is false", () => {
    const wrapper = createQueryClientWrapper();
    const meta = makeResolvedMeta();
    vi.mocked(getJobResultDotPath).mockReturnValue("/user@bvbrc/home/.myJob");

    const { result } = renderHook(
      () => useJobResultData({ resolvedJobMeta: meta, enabled: false }),
      { wrapper },
    );

    expect(result.current.dotMetaQuery.isFetching).toBe(false);
    expect(result.current.dotMeta).toBeNull();
  });
});
