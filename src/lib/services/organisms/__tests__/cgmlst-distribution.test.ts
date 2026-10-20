import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { fetchCgmlstHcDistribution } from "../cgmlst-distribution";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

function facet(field: string, entries: (string | number)[]) {
  return {
    response: { numFound: entries.length / 2 },
    facet_counts: {
      facet_fields: { [field]: entries },
    },
  };
}

describe("fetchCgmlstHcDistribution", () => {
  it("returns all 7 HC levels parsed correctly", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const url = new URL(request.url);
        const match = url.search.match(/\(field,cgmlst_(hc\d+)\)/);
        if (!match) return HttpResponse.text("unexpected", { status: 400 });
        const level = match[1]; // e.g. "hc0"
        const field = `cgmlst_${level}`;
        return HttpResponse.json(facet(field, ["1", 100, "3", 50]));
      }),
    );

    const result = await fetchCgmlstHcDistribution(234);
    expect(result.hc0).toEqual([{ name: "1", count: 100 }, { name: "3", count: 50 }]);
    expect(result.hc2).toEqual([{ name: "1", count: 100 }, { name: "3", count: 50 }]);
    expect(result.hc100).toEqual([{ name: "1", count: 100 }, { name: "3", count: 50 }]);
    // All 7 keys present
    expect(Object.keys(result)).toHaveLength(7);
  });

  it("rejects when any HC level fetch fails so the caller can surface a real error", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const url = new URL(request.url);
        if (url.search.includes("cgmlst_hc2")) {
          return HttpResponse.text("hc2 error", { status: 503 });
        }
        const match = url.search.match(/\(field,cgmlst_(hc\d+)\)/);
        if (!match) return HttpResponse.text("unexpected", { status: 400 });
        const level = match[1];
        const field = `cgmlst_${level}`;
        return HttpResponse.json(facet(field, ["1", 100]));
      }),
    );

    await expect(fetchCgmlstHcDistribution(234)).rejects.toMatchObject({
      message:
        "cgMLST HC2 Distribution: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: hc2 error).",
      source: "genome cgmlst_hc2 facet",
    });
  });
});
