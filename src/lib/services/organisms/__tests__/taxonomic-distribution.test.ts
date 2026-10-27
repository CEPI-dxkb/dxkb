import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { fetchTaxonomicDistribution } from "../taxonomic-distribution";

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

describe("fetchTaxonomicDistribution", () => {
  it("returns genus and species facets in parallel", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const url = new URL(request.url);
        if (url.search.includes("(field,genus)")) {
          return HttpResponse.json(facet("genus", ["Brucella", 100]));
        }
        if (url.search.includes("(field,species)")) {
          return HttpResponse.json(
            facet("species", ["Brucella abortus", 50, "Brucella melitensis", 30]),
          );
        }
        return HttpResponse.text("unexpected", { status: 400 });
      }),
    );

    const result = await fetchTaxonomicDistribution(234);
    expect(result.genus).toEqual([{ name: "Brucella", count: 100 }]);
    expect(result.species).toEqual([
      { name: "Brucella abortus", count: 50 },
      { name: "Brucella melitensis", count: 30 },
    ]);
  });

  it("throws when the genus fetch fails", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const url = new URL(request.url);
        if (url.search.includes("(field,genus)")) {
          return HttpResponse.text("genus error", { status: 503 });
        }
        return HttpResponse.json(facet("species", []));
      }),
    );

    await expect(fetchTaxonomicDistribution(234)).rejects.toMatchObject({
      message:
        "Taxonomic Distribution: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: genus error).",
      source: "taxonomic distribution genus",
    });
  });

  it("throws when the species fetch fails", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const url = new URL(request.url);
        if (url.search.includes("(field,species)")) {
          return HttpResponse.text("species error", { status: 503 });
        }
        return HttpResponse.json(facet("genus", ["Brucella", 100]));
      }),
    );

    await expect(fetchTaxonomicDistribution(234)).rejects.toMatchObject({
      message:
        "Taxonomic Distribution: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: species error).",
      source: "taxonomic distribution species",
    });
  });
});
