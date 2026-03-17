import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";

import { fetchFeaturesFromGroup } from "../feature";

describe("fetchFeaturesFromGroup", () => {
  it("returns [] for an empty path", async () => {
    const result = await fetchFeaturesFromGroup("");
    expect(result).toEqual([]);
  });

  it("returns [] for a whitespace-only path", async () => {
    const result = await fetchFeaturesFromGroup("   ");
    expect(result).toEqual([]);
  });

  it("fetches features and returns data.results on success", async () => {
    const features = [
      { feature_id: "fig|123.4.peg.1", product: "hypothetical protein" },
      { feature_id: "fig|123.4.peg.2", product: "kinase" },
    ];

    let capturedBody: unknown;

    server.use(
      http.post("/api/services/feature/from-group", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ results: features });
      }),
    );

    const result = await fetchFeaturesFromGroup("/my/feature/group");

    expect(capturedBody).toEqual({ feature_group_path: "/my/feature/group" });
    expect(result).toEqual(features);
  });

  it("throws on HTTP error", async () => {
    server.use(
      http.post("/api/services/feature/from-group", () => {
        return HttpResponse.json({ error: "group not found" }, { status: 404 });
      }),
    );

    await expect(fetchFeaturesFromGroup("/bad/path")).rejects.toThrow("group not found");
  });

  it("returns [] when the request is aborted", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

    const result = await fetchFeaturesFromGroup("/some/path", {
      signal: AbortSignal.abort(),
    });

    expect(result).toEqual([]);
  });
});
