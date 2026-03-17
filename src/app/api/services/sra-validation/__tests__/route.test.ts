import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { GET } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-ncbi"),
}));

describe("GET /api/services/sra-validation", () => {
  it("returns 400 when accession is missing", async () => {
    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "accession parameter is required" }),
    );
  });

  it("returns 400 for invalid accession format", async () => {
    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "INVALID" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Invalid accession format"),
      }),
    );
  });

  it("returns 400 for accession with wrong pattern (numbers first)", async () => {
    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "123SRR" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns success with XML text on valid response", async () => {
    const xmlText = "<xml>valid</xml>";

    server.use(
      http.get("http://mock-ncbi", () => {
        return new HttpResponse(xmlText);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "SRR123456" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ success: true, xml: xmlText });
  });

  it("returns accession-not-valid error on NCBI 4xx", async () => {
    server.use(
      http.get("http://mock-ncbi", () => {
        return new HttpResponse("Not Found", { status: 404 });
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "SRR999999" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("not valid"),
      }),
    );
  });

  it("returns NCBI error status on 5xx", async () => {
    server.use(
      http.get("http://mock-ncbi", () => {
        return new HttpResponse("Service Unavailable", { status: 503 });
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "SRR123456" },
    });
    const res = await GET(req);

    expect(res.status).toBe(503);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("NCBI API error"),
      }),
    );
  });

  it("returns success with timeout flag on AbortError", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "SRR123456" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        success: true,
        timeout: true,
        accession: "SRR123456",
      }),
    );

  });

  it("returns 500 on other errors", async () => {
    server.use(
      http.get("http://mock-ncbi", () => {
        return HttpResponse.error();
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/sra-validation",
      searchParams: { accession: "SRR123456" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
