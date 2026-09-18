import {
  clearTestCookies,
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { GET } from "../route";
import { createAppService } from "@/lib/app-service";

const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  fetchJobOutput: vi.fn(),
};

describe("GET /api/services/app-service/jobs/[id]/stderr", () => {
  beforeEach(() => {
    setTestSession();
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    clearTestCookies();

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext({ id: "job-1" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(data).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns plain text stderr output on success", async () => {
    const stderrText = "Warning: low memory\nError: segfault";
    mockAppService.fetchJobOutput.mockResolvedValue(stderrText);

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext({ id: "job-err-out" }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(text).toBe(stderrText);
    expect(mockAppService.fetchJobOutput).toHaveBeenCalledWith({
      job_id: "job-err-out",
      output_type: "stderr",
    });
  });

  it("returns 500 when an error is thrown", async () => {
    mockAppService.fetchJobOutput.mockRejectedValue(
      new Error("Fetch failed"),
    );

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext({ id: "job-err" }));
    const data = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(data).toEqual(expect.objectContaining({ error: "Fetch failed" }));
  });
});
