import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { DataRepository, DataRepositoryError } from "../client";
import type { DownloadRequest } from "../downloads";

// Its own file because `client.test.ts` replaces `global.fetch` and restores
// the pre-MSW original after each case, which would leave these requests
// unintercepted.
describe("DataRepository.download", () => {
  const request: DownloadRequest = {
    format: "csv",
    scope: { kind: "selected", ids: ["1.1", "1.2"] },
    sort: { field: "genome_name", direction: "asc" },
    fileNameBase: "genome-selected",
    total: 2,
  };

  it("POSTs the request as JSON to the resource's download route and returns a typed Blob", async () => {
    const seen: { contentType: string | null; body: unknown }[] = [];
    server.use(
      http.post("*/api/data/genome/download", async ({ request: sent }) => {
        seen.push({
          contentType: sent.headers.get("Content-Type"),
          body: await sent.json(),
        });
        return new Response("a,b\n", {
          headers: { "Content-Type": "text/csv; charset=utf-8" },
        });
      }),
    );

    const blob = await new DataRepository().download("genome", request);

    expect(seen).toEqual([{ contentType: "application/json", body: request }]);
    expect(blob.type).toMatch(/^text\/csv;\s?charset=utf-8$/);
    expect(await blob.text()).toBe("a,b\n");
  });

  it("types a Blob the gateway sent without a Content-Type", async () => {
    server.use(
      http.post(
        "*/api/data/genome/download",
        () =>
          new Response(new Blob([new Uint8Array([80, 75])]), {
            headers: { "Content-Type": "" },
          }),
      ),
    );

    const blob = await new DataRepository().download("genome", {
      ...request,
      format: "xlsx",
    });

    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("retries a rate-limited download after its Retry-After", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/data/genome/download", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: "Too many downloads.", code: "rate_limited" },
              { status: 429, headers: { "Retry-After": "0" } },
            )
          : new Response("a,b\n", { headers: { "Content-Type": "text/csv" } });
      }),
    );

    const blob = await new DataRepository().download("genome", request);

    expect(calls).toBe(2);
    expect(await blob.text()).toBe("a,b\n");
  });

  it("throws the gateway's own message", async () => {
    server.use(
      http.post("*/api/data/genome/download", () =>
        HttpResponse.json(
          { error: "Over Excel's 1,048,576-row limit.", code: "invalid_request" },
          { status: 400 },
        ),
      ),
    );

    const error: unknown = await new DataRepository()
      .download("genome", request)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DataRepositoryError);
    expect(error).toMatchObject({
      message: "Over Excel's 1,048,576-row limit.",
      status: 400,
      code: "invalid_request",
    });
  });
});
