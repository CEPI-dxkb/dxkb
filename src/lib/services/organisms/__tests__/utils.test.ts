import { http, HttpResponse } from "msw";

import { chartColors, chartTooltipStyle, donutFallbackColor } from "@/lib/services/organisms/chart-utils";
import {
  buildGenomeFacetUrl,
  buildGenomeGeoFacetUrl,
  buildGenomeGeoPivot3Url,
  buildGenomeGeoPivotUrl,
  fetchOrganismSolrJson,
  fetchOrganismSolrJsonPost,
  numberOrNull,
  parseSolrFacetList,
  parseSolrFacetPivot,
  parseSolrFacetPivot3,
  requiredNumber,
  requiredString,
} from "@/lib/services/organisms/utils";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

describe("numberOrNull", () => {
  it("returns null for null, undefined, empty string", () => {
    expect(numberOrNull(null, "x")).toBeNull();
    expect(numberOrNull(undefined, "x")).toBeNull();
    expect(numberOrNull("", "x")).toBeNull();
  });

  it("accepts numbers and numeric strings", () => {
    expect(numberOrNull(42, "x")).toBe(42);
    expect(numberOrNull("42", "x")).toBe(42);
    expect(numberOrNull("3.14", "x")).toBe(3.14);
  });

  it("rejects booleans even though Number(true) === 1", () => {
    expect(() => numberOrNull(true, "flag")).toThrow(/flag is not numeric/);
    expect(() => numberOrNull(false, "flag")).toThrow(/flag is not numeric/);
  });

  it("rejects arrays even though Number([5]) === 5", () => {
    expect(() => numberOrNull([5], "field")).toThrow(/field is not numeric/);
    expect(() => numberOrNull([], "field")).toThrow(/field is not numeric/);
  });

  it("rejects objects", () => {
    expect(() => numberOrNull({}, "field")).toThrow(/field is not numeric/);
  });

  it("throws when the numeric coercion produces NaN", () => {
    expect(() => numberOrNull("not a number", "x")).toThrow(/x is not numeric/);
  });
});

describe("requiredNumber / requiredString", () => {
  it("requiredNumber throws on missing", () => {
    expect(() => requiredNumber(null, "x")).toThrow(/x is missing/);
  });

  it("requiredString throws on missing or empty", () => {
    expect(() => requiredString("", "x")).toThrow(/x is missing/);
    expect(() => requiredString(null, "x")).toThrow(/x is missing/);
    expect(requiredString("hello", "x")).toBe("hello");
  });
});

describe("buildGenomeFacetUrl", () => {
  it("omits the limit clause when limit is undefined", () => {
    const url = buildGenomeFacetUrl(baseUrl, 234, "genus");
    expect(url).not.toContain("(limit,");
  });

  it("omits the limit clause when limit is 0 (was a truthiness trap)", () => {
    const url = buildGenomeFacetUrl(baseUrl, 234, "genus", 0);
    expect(url).not.toContain("(limit,");
  });

  it("includes the limit clause when limit is positive", () => {
    const url = buildGenomeFacetUrl(baseUrl, 234, "genus", 12);
    expect(url).toContain("(limit,12)");
  });
});

describe("buildGenomeGeoFacetUrl / buildGenomeGeoPivotUrl", () => {
  it("omits the limit clause when limit is 0", () => {
    expect(buildGenomeGeoFacetUrl(baseUrl, 234, "isolation_country", 0)).not.toContain("(limit,");
    expect(buildGenomeGeoPivotUrl(baseUrl, 234, "a", "b", 0)).not.toContain("(limit,");
  });

  it("includes the limit clause when limit is positive", () => {
    expect(buildGenomeGeoFacetUrl(baseUrl, 234, "isolation_country", 300)).toContain("(limit,300)");
    expect(buildGenomeGeoPivotUrl(baseUrl, 234, "a", "b", 500)).toContain("(limit,500)");
  });
});

describe("genome-query scopes", () => {
  const scope = {
    fieldRql: "eq(genome_status,Complete)",
    keywordRql: "keyword(pseudomonas)",
  };

  it("runs a Genome query in place of the taxon lineage", () => {
    expect(buildGenomeFacetUrl(baseUrl, scope, "genus", 12)).toBe(
      `${baseUrl}/genome/?and(eq(genome_status,Complete),keyword(pseudomonas))&limit(1)&facet((field,genus),(limit,12),(mincount,1))`,
    );
  });

  it("runs a Genome query's geographic facets without the genome self-join", () => {
    expect(buildGenomeGeoFacetUrl(baseUrl, scope, "isolation_country", 300)).toBe(
      `${baseUrl}/genome/?and(eq(genome_status,Complete),keyword(pseudomonas))&facet((field,isolation_country),(mincount,1),(limit,300))&limit(0)`,
    );
    expect(buildGenomeGeoPivotUrl(baseUrl, scope, "a", "b")).toBe(
      `${baseUrl}/genome/?and(eq(genome_status,Complete),keyword(pseudomonas))&facet((pivot,(a,b)),(mincount,1))&limit(0)`,
    );
    expect(buildGenomeGeoPivot3Url(baseUrl, scope, "a", "b", "c")).toContain(
      "/genome/?and(eq(genome_status,Complete),keyword(pseudomonas))&facet((pivot,(a,b,c))",
    );
  });

  it("runs a taxon's geographic requests on its lineage without the self-join", () => {
    expect(buildGenomeGeoFacetUrl(baseUrl, 234, "isolation_country")).toBe(
      `${baseUrl}/genome/?eq(taxon_lineage_ids,234)&facet((field,isolation_country),(mincount,1))&limit(0)`,
    );
    expect(buildGenomeGeoPivotUrl(baseUrl, 234, "a", "b", 1000)).toBe(
      `${baseUrl}/genome/?eq(taxon_lineage_ids,234)&facet((pivot,(a,b)),(mincount,1),(limit,1000))&limit(0)`,
    );
    expect(buildGenomeGeoPivot3Url(baseUrl, 234, "a", "b", "c")).toBe(
      `${baseUrl}/genome/?eq(taxon_lineage_ids,234)&facet((pivot,(a,b,c)),(mincount,1))&limit(0)`,
    );
  });
});

describe("buildGenomeGeoPivot3Url", () => {
  it("emits a 3-field pivot clause", () => {
    const url = buildGenomeGeoPivot3Url(baseUrl, 234, "state_province", "county", "genus");
    expect(url).toContain("(pivot,(state_province,county,genus))");
  });

  it("appends the limit clause when positive", () => {
    const url = buildGenomeGeoPivot3Url(baseUrl, 234, "a", "b", "c", 1000);
    expect(url).toContain("(limit,1000)");
  });

  it("omits the limit clause when limit is 0", () => {
    const url = buildGenomeGeoPivot3Url(baseUrl, 234, "a", "b", "c", 0);
    expect(url).not.toContain("(limit,");
  });
});

describe("parseSolrFacetList", () => {
  it("parses [name, count] pairs", () => {
    const payload = {
      facet_counts: { facet_fields: { genus: ["Escherichia", 20, "Salmonella", 10] } },
    };
    expect(parseSolrFacetList(payload, "genus")).toEqual([
      { name: "Escherichia", count: 20 },
      { name: "Salmonella", count: 10 },
    ]);
  });

  it("throws on missing facet_counts", () => {
    expect(() => parseSolrFacetList({}, "genus")).toThrow(/missing facet_counts/);
  });

  it("throws on missing facet_fields", () => {
    expect(() => parseSolrFacetList({ facet_counts: {} }, "genus")).toThrow(/missing facet_fields/);
  });

  it("throws when the field facet is absent", () => {
    expect(() =>
      parseSolrFacetList({ facet_counts: { facet_fields: {} } }, "genus"),
    ).toThrow(/missing genus facet/);
  });

  it("coerces string counts via requiredNumber", () => {
    const payload = {
      facet_counts: { facet_fields: { genus: ["Escherichia", "20"] } },
    };
    expect(parseSolrFacetList(payload, "genus")).toEqual([{ name: "Escherichia", count: 20 }]);
  });
});

describe("parseSolrFacetPivot", () => {
  it("parses outer string keys with inner counts", () => {
    const payload = {
      facet_counts: {
        facet_pivot: {
          "country,genus": [
            { value: "USA", count: 100, pivot: [{ value: "Brucella", count: 60 }] },
          ],
        },
      },
    };
    expect(parseSolrFacetPivot(payload, "country,genus")).toEqual({
      USA: { Brucella: 60 },
    });
  });

  it("coerces numeric outer keys to strings (collection_year shape)", () => {
    const payload = {
      facet_counts: {
        facet_pivot: {
          "collection_year,serovar": [
            { value: 2023, pivot: [{ value: "Sv1", count: 10 }] },
            { value: 2024, pivot: [{ value: "Sv1", count: 5 }] },
          ],
        },
      },
    };
    expect(parseSolrFacetPivot(payload, "collection_year,serovar")).toEqual({
      "2023": { Sv1: 10 },
      "2024": { Sv1: 5 },
    });
  });

  it("coerces string sub-counts", () => {
    const payload = {
      facet_counts: {
        facet_pivot: {
          "country,genus": [
            { value: "USA", pivot: [{ value: "Brucella", count: "60" }] },
          ],
        },
      },
    };
    expect(parseSolrFacetPivot(payload, "country,genus")).toEqual({
      USA: { Brucella: 60 },
    });
  });

  it("throws when the pivot key is absent", () => {
    expect(() =>
      parseSolrFacetPivot({ facet_counts: { facet_pivot: {} } }, "a,b"),
    ).toThrow(/missing a,b pivot/);
  });
});

describe("parseSolrFacetPivot3", () => {
  it("parses 3-level nested pivot into a nested map", () => {
    const payload = {
      facet_counts: {
        facet_pivot: {
          "state_province,county,genus": [
            {
              value: "Wyoming",
              count: 48,
              pivot: [
                {
                  value: "Park",
                  count: 30,
                  pivot: [{ value: "Brucella", count: 30 }],
                },
                {
                  value: "Teton",
                  count: 18,
                  pivot: [{ value: "Brucella", count: 18 }],
                },
              ],
            },
          ],
        },
      },
    };
    expect(parseSolrFacetPivot3(payload, "state_province,county,genus")).toEqual({
      Wyoming: {
        Park: { Brucella: 30 },
        Teton: { Brucella: 18 },
      },
    });
  });

  it("treats missing inner pivot arrays as empty leaves", () => {
    const payload = {
      facet_counts: {
        facet_pivot: {
          "a,b,c": [
            { value: "Outer", count: 5, pivot: [{ value: "Middle", count: 5 }] },
          ],
        },
      },
    };
    expect(parseSolrFacetPivot3(payload, "a,b,c")).toEqual({
      Outer: { Middle: {} },
    });
  });

  it("coerces string leaf counts", () => {
    const payload = {
      facet_counts: {
        facet_pivot: {
          "a,b,c": [
            {
              value: "Outer",
              pivot: [
                { value: "Middle", pivot: [{ value: "Leaf", count: "12" }] },
              ],
            },
          ],
        },
      },
    };
    expect(parseSolrFacetPivot3(payload, "a,b,c")).toEqual({
      Outer: { Middle: { Leaf: 12 } },
    });
  });

  it("throws when the pivot key is absent", () => {
    expect(() =>
      parseSolrFacetPivot3({ facet_counts: { facet_pivot: {} } }, "a,b,c"),
    ).toThrow(/missing a,b,c pivot/);
  });
});

describe("fetchOrganismSolrJson", () => {
  beforeEach(() => {
    process.env.BVBRC_WEBSITE_API_URL = baseUrl;
  });
  afterEach(() => {
    delete process.env.BVBRC_WEBSITE_API_URL;
  });

  it("sets Accept: application/solr+json and returns the parsed object", async () => {
    let receivedAccept = "";
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        receivedAccept = request.headers.get("Accept") ?? "";
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await fetchOrganismSolrJson(`${baseUrl}/genome/`, { source: "test" });
    expect(receivedAccept).toBe("application/solr+json");
    expect(result).toEqual({ ok: true });
  });

  it("propagates AbortSignal", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({});
      }),
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchOrganismSolrJson(`${baseUrl}/genome/`, { source: "test" }, controller.signal),
    ).rejects.toThrow();
  });

  it("prefixes a non-ok response's message with the label, never the source", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.text("upstream down", { status: 503 }),
      ),
    );

    await expect(
      fetchOrganismSolrJson(`${baseUrl}/genome/`, {
        source: "genome host_name facet",
        label: "Host Name",
      }),
    ).rejects.toMatchObject({
      message:
        "Host Name: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: upstream down).",
      source: "genome host_name facet",
    });
  });
});

describe("chartTooltipStyle", () => {
  it("uses left+top when the tooltip fits to the right and below the cursor", () => {
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const style = chartTooltipStyle(100, 200, 150, 30);
    expect(style).toEqual({ left: 112, top: 164 });
  });

  it("flips to right anchor when the tooltip would overflow to the right", () => {
    Object.defineProperty(window, "innerWidth", { value: 200, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const style = chartTooltipStyle(180, 100, 150, 30);
    expect(style.left).toBeUndefined();
    expect(style.right).toBeDefined();
  });

  it("flips top when the tooltip would overflow above the viewport", () => {
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const style = chartTooltipStyle(100, 10, 150, 30);
    // offsetY default = -36; 10 + -36 < 0 so it flips downward
    expect(style.top).toBeGreaterThan(10);
  });
});

describe("chart palette exports", () => {
  it("exports 10 chart colors", () => {
    expect(chartColors).toHaveLength(10);
    expect(chartColors[0]).toBe("var(--chart-1)");
    expect(chartColors[9]).toBe("var(--chart-10)");
  });

  it("exports a fallback color for donut Others", () => {
    expect(donutFallbackColor).toBe("var(--muted-foreground)");
  });
});

describe("fetchOrganismSolrJsonPost", () => {
  const url = "https://bvbrc.test/api-for-website/genome_amr/";

  it("POSTs the body with rqlquery content-type and solr Accept header", async () => {
    let capturedMethod = "";
    let capturedBody = "";
    let capturedAccept = "";
    let capturedContentType = "";

    server.use(
      http.post(url, async ({ request }) => {
        capturedMethod = request.method;
        capturedBody = await request.text();
        capturedAccept = request.headers.get("Accept") ?? "";
        capturedContentType = request.headers.get("Content-Type") ?? "";
        return HttpResponse.json({ ok: true });
      }),
    );

    await fetchOrganismSolrJsonPost(url, "eq(genome_id,*)", { source: "amr test" });

    expect(capturedMethod).toBe("POST");
    expect(capturedBody).toBe("eq(genome_id,*)");
    expect(capturedAccept).toBe("application/solr+json");
    expect(capturedContentType).toBe("application/rqlquery+x-www-form-urlencoded");
  });

  it("throws the upstream error message on non-ok response", async () => {
    server.use(
      http.post(url, () => HttpResponse.text("upstream timeout", { status: 504 })),
    );

    await expect(
      fetchOrganismSolrJsonPost(url, "body", { source: "amr test" }),
    ).rejects.toThrow(
      "The BV-BRC data service is unavailable (HTTP 504 Gateway Timeout: upstream timeout).",
    );
  });

  it("rejects malformed JSON responses behind the label, never the source", async () => {
    server.use(
      http.post(url, () => HttpResponse.text("not json", { status: 200 })),
    );

    const error: unknown = await fetchOrganismSolrJsonPost(url, "body", {
      source: "amr test",
      label: "AMR",
    }).catch((caught: unknown) => caught);

    expect((error as Error).message).toMatch(/^AMR: Malformed JSON response: /);
    expect((error as Error).message).not.toContain("amr test");
  });
});
