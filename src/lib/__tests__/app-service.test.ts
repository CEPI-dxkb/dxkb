import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { AppService, createAppService } from "@/lib/app-service";
import { createBvBrcClient } from "@/lib/jsonrpc-client";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { connectTimeout } from "@/test-helpers/upstream-failures";

vi.mock("@/lib/jsonrpc-client", () => ({
  createBvBrcClient: vi.fn(() => ({
    call: vi.fn(),
    getAuthToken: vi.fn(),
  })),
}));

describe("AppService", () => {
  let service: AppService;
  let mockClient: { call: ReturnType<typeof vi.fn>; getAuthToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = new AppService("test-token");
    mockClient = ((createBvBrcClient as ReturnType<typeof vi.fn>).mock.results[0] as { value: typeof mockClient }).value;
  });

  describe("constructor", () => {
    it("creates a client with the provided token", () => {
      expect(createBvBrcClient).toHaveBeenCalledWith("test-token");
    });
  });

  describe("queryJobDetails", () => {
    it("calls correct method with job_id and include_logs", async () => {
      const expected = { id: "123", status: "completed" };
      mockClient.call.mockResolvedValue(expected);

      const result = await service.queryJobDetails({
        job_id: "123",
        include_logs: true,
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.query_task_details",
        ["123", true],
      );
      expect(result).toEqual(expected);
    });

    it("defaults include_logs to false", async () => {
      mockClient.call.mockResolvedValue({});

      await service.queryJobDetails({ job_id: "456" });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.query_task_details",
        ["456", false],
      );
    });
  });

  describe("killJob", () => {
    it("converts [1, msg] to { success: true, message }", async () => {
      mockClient.call.mockResolvedValue([1, "Canceled 18978105"]);

      const result = await service.killJob({ job_id: "18978105" });

      expect(mockClient.call).toHaveBeenCalledWith("AppService.kill_task", [
        18978105,
      ]);
      expect(result).toEqual({
        success: true,
        message: "Canceled 18978105",
      });
    });

    it("converts [0, msg] to { success: false, message }", async () => {
      mockClient.call.mockResolvedValue([0, "Task not found"]);

      const result = await service.killJob({ job_id: "999" });

      expect(result).toEqual({
        success: false,
        message: "Task not found",
      });
    });

    it("converts job_id to a number", async () => {
      mockClient.call.mockResolvedValue([1, "ok"]);

      await service.killJob({ job_id: "42" });

      expect(mockClient.call).toHaveBeenCalledWith("AppService.kill_task", [
        42,
      ]);
    });
  });

  describe("fetchJobOutput", () => {
    // Not the production host: the output endpoint must follow APP_SERVICE_URL.
    const appServiceUrl = "https://app.example.test/services/app_service";

    beforeEach(() => {
      vi.stubEnv("APP_SERVICE_URL", appServiceUrl);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("makes GET request with OAuth auth header", async () => {
      mockClient.getAuthToken.mockReturnValue("my-token");

      let capturedRequest: { url: string; headers: Headers } | undefined;
      server.use(
        http.get(
          `${appServiceUrl}/task_info/123/stdout`,
          ({ request }) => {
            capturedRequest = {
              url: request.url,
              headers: request.headers,
            };
            return new HttpResponse("stdout content here");
          },
        ),
      );

      const result = await service.fetchJobOutput({
        job_id: "123",
        output_type: "stdout",
      });

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest?.headers.get("Authorization")).toBe("OAuth my-token");
      expect(result).toBe("stdout content here");
    });

    it("throws when no auth token", async () => {
      mockClient.getAuthToken.mockReturnValue(undefined);

      await expect(
        service.fetchJobOutput({ job_id: "123", output_type: "stderr" }),
      ).rejects.toThrow("Authentication token not available");
    });

    it("throws on HTTP error", async () => {
      mockClient.getAuthToken.mockReturnValue("my-token");

      server.use(
        http.get(
          `${appServiceUrl}/task_info/123/stdout`,
          () => {
            return new HttpResponse(null, { status: 404 });
          },
        ),
      );

      await expect(
        service.fetchJobOutput({ job_id: "123", output_type: "stdout" }),
      ).rejects.toThrow("Failed to fetch stdout for job 123");
    });

    it("builds the output URL from APP_SERVICE_URL, ignoring a trailing slash", async () => {
      vi.stubEnv("APP_SERVICE_URL", `${appServiceUrl}/`);
      mockClient.getAuthToken.mockReturnValue("my-token");
      let requestedUrl: string | undefined;
      server.use(
        http.get(`${appServiceUrl}/task_info/123/stderr`, ({ request }) => {
          requestedUrl = request.url;
          return new HttpResponse("stderr content");
        }),
      );

      await expect(
        service.fetchJobOutput({ job_id: "123", output_type: "stderr" }),
      ).resolves.toBe("stderr content");
      expect(requestedUrl).toBe(`${appServiceUrl}/task_info/123/stderr`);
    });

    it("keeps a job id inside its own path segment", async () => {
      mockClient.getAuthToken.mockReturnValue("my-token");
      let requestedUrl: string | undefined;
      server.use(
        http.get(`${appServiceUrl}/task_info/*`, ({ request }) => {
          requestedUrl = request.url;
          return new HttpResponse("");
        }),
      );

      await service.fetchJobOutput({ job_id: "../123", output_type: "stdout" });

      expect(requestedUrl).toBe(`${appServiceUrl}/task_info/..%2F123/stdout`);
    });

    it("keeps an upstream failure's status and names the job in its message", async () => {
      mockClient.getAuthToken.mockReturnValue("my-token");
      server.use(
        http.get(`${appServiceUrl}/task_info/123/stdout`, () => {
          throw connectTimeout();
        }),
      );

      const failure = await service
        .fetchJobOutput({ job_id: "123", output_type: "stdout" })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UpstreamError);
      expect(failure).toEqual(
        expect.objectContaining({
          status: 504,
          code: "upstream_timeout",
          message: expect.stringMatching(/^Failed to fetch stdout for job 123: /) as unknown,
        }),
      );
    });

    // MSW does not tie the request signal to a mocked body, so the stream
    // errors the way undici's does when the budget fires or the socket drops.
    function cutShort(error: Error): HttpResponse<ReadableStream> {
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("Starting job"));
            controller.error(error);
          },
        }),
      );
    }

    it("answers output that times out mid-body as a 504 naming the job service", async () => {
      mockClient.getAuthToken.mockReturnValue("my-token");
      server.use(
        http.get(`${appServiceUrl}/task_info/123/stdout`, () =>
          cutShort(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
        ),
      );

      const failure = await service
        .fetchJobOutput({ job_id: "123", output_type: "stdout" })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UpstreamError);
      expect(failure).toEqual(
        expect.objectContaining({
          status: 504,
          code: "upstream_timeout",
          message:
            "Failed to fetch stdout for job 123: The BV-BRC job service did not respond (timed out after 30 s).",
        }),
      );
    });

    it("answers output cut off by a dropped connection as a 502", async () => {
      mockClient.getAuthToken.mockReturnValue("my-token");
      const reset = new TypeError("terminated", {
        cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
      });
      server.use(
        http.get(`${appServiceUrl}/task_info/123/stderr`, () => cutShort(reset)),
      );

      const failure = await service
        .fetchJobOutput({ job_id: "123", output_type: "stderr" })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UpstreamError);
      expect(failure).toEqual(
        expect.objectContaining({
          status: 502,
          code: "service_unavailable",
          message:
            "Failed to fetch stderr for job 123: Could not reach the BV-BRC job service: connection closed.",
        }),
      );
    });
  });

  describe("enumerateTasksFiltered", () => {
    it("maps sort_field 'status' to 'service_status'", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 0,
        limit: 25,
        sort_field: "status",
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [0, 25, { sort_field: "service_status" }],
      );
    });

    it("maps sort_field 'app' to 'application_id'", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 0,
        limit: 10,
        sort_field: "app",
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [0, 10, { sort_field: "application_id" }],
      );
    });

    it("maps sort_field 'completed_time' to 'finish_time'", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 0,
        limit: 10,
        sort_field: "completed_time",
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [0, 10, { sort_field: "finish_time" }],
      );
    });

    it("passes through unmapped sort_field values as-is", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 0,
        limit: 10,
        sort_field: "submit_time",
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [0, 10, { sort_field: "submit_time" }],
      );
    });

    it("includes include_archived, sort_order, and app in opts", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 5,
        limit: 50,
        include_archived: true,
        sort_field: "status",
        sort_order: "desc",
        app: "GenomeAssembly2",
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [
          5,
          50,
          {
            include_archived: 1,
            sort_field: "service_status",
            sort_order: "desc",
            app: "GenomeAssembly2",
          },
        ],
      );
    });

    it("sends empty opts when no optional params provided", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 0,
        limit: 25,
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [0, 25, {}],
      );
    });

    it("passes start_time and end_time in opts", async () => {
      mockClient.call.mockResolvedValue([[], 0]);

      await service.enumerateTasksFiltered({
        offset: 0,
        limit: 25,
        start_time: "2026-01-01",
        end_time: "2026-02-01",
      });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.enumerate_tasks_filtered",
        [0, 25, { start_time: "2026-01-01", end_time: "2026-02-01" }],
      );
    });

    it("parses [[...jobs], totalTasks] response format", async () => {
      const jobs = [{ id: "job-1" }, { id: "job-2" }];
      mockClient.call.mockResolvedValue([jobs, 42]);

      const result = await service.enumerateTasksFiltered({
        offset: 0,
        limit: 25,
      });

      expect(result).toEqual({ jobs, totalTasks: 42 });
    });
  });

  describe("queryTaskSummaryFiltered", () => {
    it("includes include_archived in opts when true", async () => {
      mockClient.call.mockResolvedValue({});

      await service.queryTaskSummaryFiltered({ include_archived: true });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.query_task_summary_filtered",
        [{ include_archived: 1 }],
      );
    });

    it("sends empty opts when include_archived is falsy", async () => {
      mockClient.call.mockResolvedValue({});

      await service.queryTaskSummaryFiltered({});

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.query_task_summary_filtered",
        [{}],
      );
    });
  });

  describe("queryAppSummaryFiltered", () => {
    it("includes include_archived in opts when true", async () => {
      mockClient.call.mockResolvedValue({});

      await service.queryAppSummaryFiltered({ include_archived: true });

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.query_app_summary_filtered",
        [{ include_archived: 1 }],
      );
    });

    it("sends empty opts when include_archived is falsy", async () => {
      mockClient.call.mockResolvedValue({});

      await service.queryAppSummaryFiltered({});

      expect(mockClient.call).toHaveBeenCalledWith(
        "AppService.query_app_summary_filtered",
        [{}],
      );
    });
  });

  describe("submitService", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("calls start_app2 with app_name, params, and APP_BASE_URL as the base_url", async () => {
      vi.stubEnv("APP_BASE_URL", "https://dev.dxkb.org/");
      const expected = { success: true, job: [{ id: "999" }] };
      mockClient.call.mockResolvedValue(expected);

      const result = await service.submitService({
        app_name: "GenomeAssembly2",
        app_params: { genome_id: "123" },
      });

      expect(mockClient.call).toHaveBeenCalledWith("AppService.start_app2", [
        "GenomeAssembly2",
        { genome_id: "123" },
        { base_url: "https://dev.dxkb.org" },
      ]);
      expect(result).toEqual(expected);
    });

    it.each([
      ["missing", "", "Missing required environment variable: APP_BASE_URL"],
      [
        "malformed",
        "dxkb.org",
        'APP_BASE_URL must be an absolute http(s) URL, got "dxkb.org"',
      ],
    ])("submits nothing when APP_BASE_URL is %s", async (_name, value, message) => {
      vi.stubEnv("APP_BASE_URL", value);

      await expect(
        service.submitService({ app_name: "MyApp", app_params: {} }),
      ).rejects.toThrow(message);
      expect(mockClient.call).not.toHaveBeenCalled();
    });
  });
});

describe("createAppService", () => {
  it("returns an AppService instance", () => {
    const service = createAppService("my-token");
    expect(service).toBeInstanceOf(AppService);
  });

  it("passes token to the constructor", () => {
    createAppService("factory-token");
    expect(createBvBrcClient).toHaveBeenCalledWith("factory-token");
  });
});
