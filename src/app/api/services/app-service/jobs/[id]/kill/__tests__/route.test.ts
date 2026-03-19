import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";

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
  killJob: vi.fn(),
};

describe("POST /api/services/app-service/jobs/[id]/kill", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    mockGetToken.mockResolvedValue(null);

    const request = mockNextRequest({ method: "POST" });

    const response = await POST(request, makeRouteContext("job-1"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns result on successful kill", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const killResult = { killed: true };
    mockAppService.killJob.mockResolvedValue(killResult);

    const request = mockNextRequest({ method: "POST" });

    const response = await POST(request, makeRouteContext("job-abc"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(killResult);
  });

  it("passes the correct job ID to killJob", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.killJob.mockResolvedValue({ killed: true });

    const request = mockNextRequest({ method: "POST" });

    await POST(request, makeRouteContext("specific-job-id"));

    expect(mockAppService.killJob).toHaveBeenCalledWith({
      job_id: "specific-job-id",
    });
  });

  it("returns 500 when an error is thrown", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.killJob.mockRejectedValue(new Error("Kill failed"));

    const request = mockNextRequest({ method: "POST" });

    const response = await POST(request, makeRouteContext("job-fail"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Kill failed" });
  });
});
