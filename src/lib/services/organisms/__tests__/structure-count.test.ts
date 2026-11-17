import { http, HttpResponse } from "msw";

import {
  experimentalStructureRql,
  fetchExperimentalStructureCount,
} from "@/lib/services/organisms/structure-count";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

describe("experimentalStructureRql", () => {
  it("scopes to the taxon lineage and leaves out predicted models", () => {
    expect(experimentalStructureRql(2)).toBe(
      "and(eq(taxon_lineage_ids,2),ne(method,Predicted))",
    );
  });
});

describe("fetchExperimentalStructureCount", () => {
  it("returns numFound of the experimental-structure query", async () => {
    let seenQuery = "";
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        seenQuery = decodeURIComponent(new URL(request.url).search);
        return HttpResponse.json({ response: { numFound: 68_899, docs: [] } });
      }),
    );

    await expect(fetchExperimentalStructureCount(2)).resolves.toBe(68_899);
    expect(seenQuery).toContain("and(eq(taxon_lineage_ids,2),ne(method,Predicted))");
    expect(seenQuery).toContain("limit(1)");
  });

  it("throws on a response without numFound", async () => {
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.json({ response: {} }),
      ),
    );

    await expect(fetchExperimentalStructureCount(2)).rejects.toThrow(
      "Unexpected SOLR response shape — missing response.numFound",
    );
  });

  it("throws the original upstream text on non-2xx", async () => {
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.text("BV-BRC overloaded", { status: 503 }),
      ),
    );

    await expect(fetchExperimentalStructureCount(2)).rejects.toMatchObject({
      message:
        "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
      source: "protein_structure count",
    });
  });

  it("does not swallow abort errors", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchExperimentalStructureCount(2, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
