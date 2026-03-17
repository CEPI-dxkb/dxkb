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
  enumerateTasksFiltered: vi.fn(),
};

describe("POST /api/services/app-service/jobs/enumerate-tasks-filtered", () => {
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

  it("returns 400 when offset is negative", async () => {
    mockGetToken.mockResolvedValue("test-token");

    const request = mockNextRequest({
      method: "POST",
      body: { offset: -1 },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual(
      expect.objectContaining({ error: "Invalid request parameters" }),
    );
  });

  it("returns 400 when limit exceeds 1000", async () => {
    mockGetToken.mockResolvedValue("test-token");

    const request = mockNextRequest({
      method: "POST",
      body: { limit: 1001 },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual(
      expect.objectContaining({ error: "Invalid request parameters" }),
    );
  });

  it("returns 400 when sort_field is invalid", async () => {
    mockGetToken.mockResolvedValue("test-token");

    const request = mockNextRequest({
      method: "POST",
      body: { sort_field: "invalid_field" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual(
      expect.objectContaining({ error: "Invalid request parameters" }),
    );
  });

  it("applies defaults when body is empty", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.enumerateTasksFiltered.mockResolvedValue([]);

    const request = mockNextRequest({ method: "POST", body: {} });

    await POST(request);

    expect(mockAppService.enumerateTasksFiltered).toHaveBeenCalledWith({
      offset: 0,
      limit: 200,
      include_archived: false,
      sort_field: undefined,
      sort_order: undefined,
      app: undefined,
    });
  });

  it("passes all filter params through to the service", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.enumerateTasksFiltered.mockResolvedValue([]);

    const request = mockNextRequest({
      method: "POST",
      body: {
        offset: 50,
        limit: 25,
        include_archived: true,
        sort_field: "submit_time",
        sort_order: "desc",
        app: "GenomeAssembly2",
      },
    });

    await POST(request);

    expect(mockAppService.enumerateTasksFiltered).toHaveBeenCalledWith({
      offset: 50,
      limit: 25,
      include_archived: true,
      sort_field: "submit_time",
      sort_order: "desc",
      app: "GenomeAssembly2",
    });
  });

  it("returns jobs on success", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const jobsList = [
      { id: "job-1", status: "completed" },
      { id: "job-2", status: "queued" },
    ];
    mockAppService.enumerateTasksFiltered.mockResolvedValue(jobsList);

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ jobs: jobsList });
  });

  it("returns 500 when an error is thrown", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockAppService.enumerateTasksFiltered.mockRejectedValue(
      new Error("Query timeout"),
    );

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Query timeout" });
  });
});
