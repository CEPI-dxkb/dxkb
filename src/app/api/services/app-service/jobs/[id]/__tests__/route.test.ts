import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({
  getBvbrcAuthToken: vi.fn(),
}));

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { GET } from "../route";
import { getBvbrcAuthToken } from "@/lib/auth";
import { createAppService } from "@/lib/app-service";

const mockGetToken = vi.mocked(getBvbrcAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  queryJobDetails: vi.fn(),
};

describe("GET /api/services/app-service/jobs/[id]", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    mockGetToken.mockResolvedValue(null);

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext("job-1"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns job details on success", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const mockDetails = {
      id: "job-1",
      status: "completed",
      app: "GenomeAssembly2",
    };
    mockAppService.queryJobDetails.mockResolvedValue(mockDetails);

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext("job-1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockDetails);
  });

  it("passes include_logs=true when query param is set", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryJobDetails.mockResolvedValue({ id: "job-2" });

    const request = mockNextRequest({
      searchParams: { include_logs: "true" },
    });

    await GET(request, makeRouteContext("job-2"));

    expect(mockAppService.queryJobDetails).toHaveBeenCalledWith({
      job_id: "job-2",
      include_logs: true,
    });
  });

  it("defaults include_logs to false when query param is absent", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryJobDetails.mockResolvedValue({ id: "job-3" });

    const request = mockNextRequest();

    await GET(request, makeRouteContext("job-3"));

    expect(mockAppService.queryJobDetails).toHaveBeenCalledWith({
      job_id: "job-3",
      include_logs: false,
    });
  });

  it("returns 500 when an error is thrown", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.queryJobDetails.mockRejectedValue(
      new Error("Service unavailable"),
    );

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext("job-err"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Service unavailable" });
  });
});
