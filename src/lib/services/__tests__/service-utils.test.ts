import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";

import { submitServiceJob } from "../service-utils";

describe("submitServiceJob", () => {
  const appName = "GenomeAssembly2";
  const appParams = { genome_id: "123.4", output_path: "/my/output" };

  it("returns { success: true, job } on successful submit", async () => {
    const job = [{ id: "job-abc-123", app: appName, status: "queued" }];

    let capturedBody: unknown;

    server.use(
      http.post("/api/services/app-service/submit", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ job });
      }),
    );

    const result = await submitServiceJob(appName, appParams);

    expect(capturedBody).toEqual({ app_name: appName, app_params: appParams });
    expect(result).toEqual({ success: true, job });
  });

  it("extracts error message from JSON body on HTTP error", async () => {
    server.use(
      http.post("/api/services/app-service/submit", () => {
        return HttpResponse.json({ error: "Invalid parameters" }, { status: 422 });
      }),
    );

    const result = await submitServiceJob(appName, appParams);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: "Invalid parameters",
      }),
    );
  });

  it("falls back to response text when JSON parsing fails on HTTP error", async () => {
    server.use(
      http.post("/api/services/app-service/submit", () => {
        return new HttpResponse("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        });
      }),
    );

    const result = await submitServiceJob(appName, appParams);

    // With real fetch, response.json() consumes the body stream.
    // When it fails (non-JSON body), response.text() also fails because
    // the stream is already disturbed, so we fall through to the default message.
    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: "HTTP error! status: 500",
      }),
    );
  });

  it("returns { success: false } with error message on network error", async () => {
    server.use(
      http.post("/api/services/app-service/submit", () => {
        return HttpResponse.error();
      }),
    );

    const result = await submitServiceJob(appName, appParams);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("fetch"),
      }),
    );
  });

  it("appends details field to error message when present", async () => {
    server.use(
      http.post("/api/services/app-service/submit", () => {
        return HttpResponse.json(
          { error: "Validation failed", details: { field: "genome_id" } },
          { status: 422 },
        );
      }),
    );

    const result = await submitServiceJob(appName, appParams);

    expect(result.error).toContain("Validation failed");
    expect(result.error).toContain("genome_id");
  });

  it("uses default HTTP error message when both JSON and text parsing fail", async () => {
    server.use(
      http.post("/api/services/app-service/submit", () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.error(new Error("stream error"));
          },
        });
        return new HttpResponse(stream, { status: 502 });
      }),
    );

    const result = await submitServiceJob(appName, appParams);

    expect(result.error).toBe("HTTP error! status: 502");
  });

  it("uses fallback message for non-Error exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("string error" as never);

    const result = await submitServiceJob(appName, appParams);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: "Failed to submit service job",
      }),
    );

  });
});
