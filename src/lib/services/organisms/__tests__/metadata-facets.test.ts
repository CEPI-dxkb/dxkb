import { http, HttpResponse } from "msw";

import { fetchOrganismMetadataFacets } from "@/lib/services/organisms/metadata-facets";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

function facet(field: string, values: (string | number)[]) {
  return {
    response: { numFound: 10 },
    facet_counts: {
      facet_fields: {
        [field]: values,
      },
    },
  };
}

describe("fetchOrganismMetadataFacets", () => {
  it("fetches requested fields in parallel and returns a field map", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const url = new URL(request.url);
        const query = url.search;
        if (query.includes("(field,genus)")) {
          return HttpResponse.json(facet("genus", ["Escherichia", 20]));
        }
        if (query.includes("(field,host_name)")) {
          return HttpResponse.json(facet("host_name", ["Homo sapiens", 12]));
        }
        return HttpResponse.text("unknown field", { status: 400 });
      }),
    );

    await expect(
      fetchOrganismMetadataFacets(2, ["genus", "host_name"], { limit: 5 }),
    ).resolves.toEqual({
      genus: [{ name: "Escherichia", count: 20 }],
      host_name: [{ name: "Homo sapiens", count: 12 }],
    });
  });

  it("folds case variants into one bucket and keeps the larger spelling", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(
          facet("host_group", [
            "Human",
            100,
            "Nonhuman mammal",
            50,
            "Avian",
            40,
            "Nonhuman Mammal",
            30,
          ]),
        ),
      ),
    );

    await expect(
      fetchOrganismMetadataFacets(2, ["host_group"]),
    ).resolves.toEqual({
      host_group: [
        { name: "Human", count: 100 },
        { name: "Nonhuman mammal", count: 80 },
        { name: "Avian", count: 40 },
      ],
    });
  });

  it("over-fetches before folding and keeps only the requested number of buckets", async () => {
    let requestedUrl = "";
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json(
          facet("host_group", ["A", 5, "B", 4, "C", 3, "a", 2]),
        );
      }),
    );

    const facets = await fetchOrganismMetadataFacets(2, ["host_group"], {
      limit: 2,
    });

    expect(requestedUrl).toContain("(limit,200)");
    expect(facets.host_group).toEqual([
      { name: "A", count: 7 },
      { name: "B", count: 4 },
    ]);
  });

  it("asks for the caller's limit when it exceeds the over-fetch size", async () => {
    let requestedUrl = "";
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json(facet("host_group", ["A", 5]));
      }),
    );

    await fetchOrganismMetadataFacets(2, ["host_group"], { limit: 250 });

    expect(requestedUrl).toContain("(limit,250)");
  });

  it.each([0, -1, Number.NaN])(
    "falls back to the default of 12 buckets when limit is %s",
    async (limit) => {
      let requestedUrl = "";
      const values = Array.from({ length: 20 }, (_, index) => [
        `Bucket ${String(index)}`,
        20 - index,
      ]).flat();
      server.use(
        http.get(`${baseUrl}/genome/`, ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json(facet("host_group", values));
        }),
      );

      const facets = await fetchOrganismMetadataFacets(2, ["host_group"], {
        limit,
      });

      expect(requestedUrl).toContain("(limit,200)");
      expect(facets.host_group).toHaveLength(12);
    },
  );

  it("leaves collection_year unfolded and unlimited", async () => {
    let requestedUrl = "";
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json(
          facet("collection_year", ["2021", 3, "2020", 5]),
        );
      }),
    );

    const facets = await fetchOrganismMetadataFacets(2, ["collection_year"]);

    expect(requestedUrl).not.toContain("(limit,");
    expect(facets.collection_year).toEqual([
      { name: "2021", count: 3 },
      { name: "2020", count: 5 },
    ]);
  });

  it("throws the original message when one field fails", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        if (new URL(request.url).search.includes("(field,genus)")) {
          return HttpResponse.json(facet("genus", ["Escherichia", 20]));
        }
        return HttpResponse.text("host facet failed", { status: 502 });
      }),
    );

    await expect(
      fetchOrganismMetadataFacets(2, ["genus", "host_name"]),
    ).rejects.toThrow("host facet failed");
  });

  it("names a failed facet by its chart's title, never its field name", async () => {
    server.use(
      http.get(
        `${baseUrl}/genome/`,
        () =>
          new HttpResponse(
            "<html><title>Site Maintenance</title></html>",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const error = await fetchOrganismMetadataFacets(2, [
      "isolation_country",
    ]).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      message:
        "Isolation Country: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).",
      source: "genome isolation_country facet",
    });
    expect((error as Error).message).not.toContain("isolation_country");
  });
});
