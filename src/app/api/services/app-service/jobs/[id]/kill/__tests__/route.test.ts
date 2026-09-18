import {
  clearTestCookies,
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { POST } from "../route";
import { createAppService } from "@/lib/app-service";

const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  killJob: vi.fn(),
};

describe("POST /api/services/app-service/jobs/[id]/kill", () => {
  beforeEach(() => {
    setTestSession();
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    clearTestCookies();

    const request = mockNextRequest({ method: "POST" });

    const response = await POST(request, makeRouteContext({ id: "job-1" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(data).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns result on successful kill", async () => {
    const killResult = { killed: true };
    mockAppService.killJob.mockResolvedValue(killResult);

    const request = mockNextRequest({ method: "POST" });

    const response = await POST(request, makeRouteContext({ id: "job-abc" }));
    const data = (await response.json()) as typeof killResult;

    expect(response.status).toBe(200);
    expect(data).toEqual(killResult);
  });

  it("passes the correct job ID to killJob", async () => {
    mockAppService.killJob.mockResolvedValue({ killed: true });

    const request = mockNextRequest({ method: "POST" });

    await POST(request, makeRouteContext({ id: "specific-job-id" }));

    expect(mockAppService.killJob).toHaveBeenCalledWith({
      job_id: "specific-job-id",
    });
  });

  it("returns 500 when an error is thrown", async () => {
    mockAppService.killJob.mockRejectedValue(new Error("Kill failed"));

    const request = mockNextRequest({ method: "POST" });

    const response = await POST(request, makeRouteContext({ id: "job-fail" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data).toEqual(expect.objectContaining({ error: "Kill failed" }));
  });
});
