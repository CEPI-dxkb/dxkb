import { NextResponse } from "next/server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({
  requireAuthToken: vi.fn(),
}));

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

import { POST } from "../route";
import { requireAuthToken } from "@/lib/auth/session";
import { createAppService } from "@/lib/app-service";

const mockRequireAuthToken = vi.mocked(requireAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  enumerateTasksFiltered: vi.fn(),
};

describe("POST /api/services/app-service/jobs/enumerate-tasks-filtered", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    mockRequireAuthToken.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Authentication required" });
  });

  it("returns 400 when offset is negative", async () => {
    mockRequireAuthToken.mockResolvedValue("test-token");

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
    mockRequireAuthToken.mockResolvedValue("test-token");

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
    mockRequireAuthToken.mockResolvedValue("test-token");

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
    mockRequireAuthToken.mockResolvedValue("test-token");
    mockAppService.enumerateTasksFiltered.mockResolvedValue({ jobs: [], totalTasks: 0 });

    const request = mockNextRequest({ method: "POST", body: {} });

    await POST(request);

    expect(mockAppService.enumerateTasksFiltered).toHaveBeenCalledWith({
      offset: 0,
      limit: 200,
      include_archived: false,
      sort_field: undefined,
      sort_order: undefined,
      app: undefined,
      start_time: undefined,
      end_time: undefined,
    });
  });

  it("passes all filter params through to the service", async () => {
    mockRequireAuthToken.mockResolvedValue("test-token");
    mockAppService.enumerateTasksFiltered.mockResolvedValue({ jobs: [], totalTasks: 0 });

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
      start_time: undefined,
      end_time: undefined,
    });
  });

  it("returns jobs on success", async () => {
    mockRequireAuthToken.mockResolvedValue("test-token");
    const jobsList = [
      { id: "job-1", status: "completed" },
      { id: "job-2", status: "queued" },
    ];
    mockAppService.enumerateTasksFiltered.mockResolvedValue({ jobs: jobsList, totalTasks: 42 });

    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ jobs: jobsList, totalTasks: 42 });
  });

  it("passes date filter params through to the service", async () => {
    mockRequireAuthToken.mockResolvedValue("test-token");
    mockAppService.enumerateTasksFiltered.mockResolvedValue({ jobs: [], totalTasks: 0 });

    const request = mockNextRequest({
      method: "POST",
      body: {
        start_time: "2026-01-01",
        end_time: "2026-01-31",
      },
    });

    await POST(request);

    expect(mockAppService.enumerateTasksFiltered).toHaveBeenCalledWith(
      expect.objectContaining({
        start_time: "2026-01-01",
        end_time: "2026-01-31",
      }),
    );
  });

  it("returns 500 when an error is thrown", async () => {
    mockRequireAuthToken.mockResolvedValue("test-token");
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
