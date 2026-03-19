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

import { GET } from "../route";
import { getAuthToken } from "@/lib/auth/session";
import { createAppService } from "@/lib/app-service";

const mockGetToken = vi.mocked(getAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  fetchJobOutput: vi.fn(),
};

describe("GET /api/services/app-service/jobs/[id]/stderr", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    mockGetToken.mockResolvedValue(null);

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext("job-1"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("returns plain text stderr output on success", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const stderrText = "Warning: low memory\nError: segfault";
    mockAppService.fetchJobOutput.mockResolvedValue(stderrText);

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext("job-err-out"));
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
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.fetchJobOutput.mockRejectedValue(
      new Error("Fetch failed"),
    );

    const request = mockNextRequest();

    const response = await GET(request, makeRouteContext("job-err"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch stderr" });
  });
});
