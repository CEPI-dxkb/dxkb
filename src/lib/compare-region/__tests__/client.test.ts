import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { defaultCompareRegionSettings } from "../contract";
import { isCompareRegionSignInError, loadCompareRegion } from "../client";

describe("loadCompareRegion", () => {
  it("sends the group only with a group filter", async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get("*/api/compare-region", ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ rows: [] });
      }),
    );
    const path = "/user@bvbrc/home/Genome Groups/G1";
    await loadCompareRegion({ peg: "fig|1.1.peg.2", ...defaultCompareRegionSettings });
    await loadCompareRegion({
      peg: "fig|1.1.peg.2",
      ...defaultCompareRegionSettings,
      filter: "genomeGroup",
      group: path,
    });
    expect(seen[0].has("group")).toBe(false);
    expect(seen[1].get("filter")).toBe("genomeGroup");
    expect(seen[1].get("group")).toBe(path);
  });
});

describe("isCompareRegionSignInError", () => {
  it("names the route's 401 for a group without a session", async () => {
    server.use(
      http.get("*/api/compare-region", () =>
        HttpResponse.json(
          {
            error: "Sign in to compare against a workspace group.",
            code: "unauthorized",
          },
          { status: 401 },
        ),
      ),
    );
    const error: unknown = await loadCompareRegion({
      peg: "fig|1.1.peg.2",
      ...defaultCompareRegionSettings,
      filter: "genomeGroup",
      group: "/user@bvbrc/home/Genome Groups/G1",
    }).catch((reason: unknown) => reason);
    expect(isCompareRegionSignInError(error)).toBe(true);
    expect(error).toEqual(
      expect.objectContaining({
        message:
          "Compare Region Viewer: Sign in to compare against a workspace group.",
      }),
    );
  });

  it("is not any other failure", () => {
    expect(
      isCompareRegionSignInError(Object.assign(new Error("busy"), { status: 503 })),
    ).toBe(false);
    expect(isCompareRegionSignInError(new Error("fetch failed"))).toBe(false);
    expect(isCompareRegionSignInError(null)).toBe(false);
  });
});
