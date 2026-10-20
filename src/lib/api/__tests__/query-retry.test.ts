import { ApiCallError } from "@/lib/api/types";
import { isUpstreamOutage, shouldRetryQuery } from "@/lib/api/query-retry";
import { DataRepositoryError } from "@/lib/data-api/client";
import { WorkspaceApiError } from "@/lib/services/workspace/domain";

describe("shouldRetryQuery", () => {
  it.each([502, 503, 504])("does not retry an upstream outage (%i)", (status) => {
    expect(
      shouldRetryQuery(0, new ApiCallError({ message: "down", status, code: "upstream" })),
    ).toBe(false);
    expect(
      shouldRetryQuery(0, new DataRepositoryError("down", status, "service_unavailable")),
    ).toBe(false);
    expect(shouldRetryQuery(0, new WorkspaceApiError("down", "Workspace.ls", null, status))).toBe(
      false,
    );
  });

  it("retries other failures once", () => {
    const serverBug = new ApiCallError({ message: "boom", status: 500, code: "upstream" });
    expect(shouldRetryQuery(0, serverBug)).toBe(true);
    expect(shouldRetryQuery(1, serverBug)).toBe(false);
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(0, new WorkspaceApiError("no status", "Workspace.ls", null))).toBe(
      true,
    );
  });
});

describe("isUpstreamOutage", () => {
  it("reads only a numeric status", () => {
    expect(isUpstreamOutage({ status: "503" })).toBe(false);
    expect(isUpstreamOutage(null)).toBe(false);
    expect(isUpstreamOutage({ status: 504 })).toBe(true);
  });
});
