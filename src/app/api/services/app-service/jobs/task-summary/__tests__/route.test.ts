import { mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({
  getBvbrcAuthToken: vi.fn(),
}));

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { POST } from "../route";
import { getBvbrcAuthToken } from "@/lib/auth";
import { createAppService } from "@/lib/app-service";

const mockGetToken = vi.mocked(getBvbrcAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  queryTaskSummaryFiltered: vi.fn(),
};

describe("POST /api/services/app-service/jobs/task-summary", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    mockGetToken.mockResolvedValue(null);

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns summary on success", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const summaryData = { queued: 5, running: 2, completed: 20, failed: 1 };
    mockAppService.queryTaskSummaryFiltered.mockResolvedValue(summaryData);

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ summary: summaryData });
  });

  it("passes include_archived through to the service", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryTaskSummaryFiltered.mockResolvedValue({});

    const request = mockNextRequest({
      method: "POST",
      body: { include_archived: true },
    });

    await POST(request);

    expect(mockAppService.queryTaskSummaryFiltered).toHaveBeenCalledWith({
      include_archived: true,
    });
  });

  it("returns 500 when an error is thrown", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryTaskSummaryFiltered.mockRejectedValue(
      new Error("Service down"),
    );

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Service down" });
  });
});
