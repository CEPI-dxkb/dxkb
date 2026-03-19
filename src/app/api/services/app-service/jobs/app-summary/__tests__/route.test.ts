import { mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthToken: vi.fn(),
}));

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { POST } from "../route";
import { getAuthToken } from "@/lib/auth/session";
import { createAppService } from "@/lib/app-service";

const mockGetToken = vi.mocked(getAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  queryAppSummaryFiltered: vi.fn(),
};

describe("POST /api/services/app-service/jobs/app-summary", () => {
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
    const summaryData = { GenomeAssembly2: 3, BLAST: 12 };
    mockAppService.queryAppSummaryFiltered.mockResolvedValue(summaryData);

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ summary: summaryData });
  });

  it("passes include_archived through to the service", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryAppSummaryFiltered.mockResolvedValue({});

    const request = mockNextRequest({
      method: "POST",
      body: { include_archived: true },
    });

    await POST(request);

    expect(mockAppService.queryAppSummaryFiltered).toHaveBeenCalledWith({
      include_archived: true,
    });
  });

  it("returns 500 when an error is thrown", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryAppSummaryFiltered.mockRejectedValue(
      new Error("Timeout"),
    );

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Timeout" });
  });
});
