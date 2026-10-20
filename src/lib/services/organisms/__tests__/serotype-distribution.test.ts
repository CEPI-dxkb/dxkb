import { http, HttpResponse } from "msw";

import { fetchSerotypeDistribution } from "@/lib/services/organisms/serotype-distribution";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

function pivotResponse(pivotRows: unknown[]) {
  return {
    response: { numFound: 0 },
    facet_counts: {
      facet_pivot: {
        "collection_year,serovar": pivotRows,
      },
    },
  };
}

describe("fetchSerotypeDistribution", () => {
  it("uses the correct URL and Accept header", async () => {
    let capturedUrl = "";
    let capturedAccept = "";

    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        capturedUrl = request.url;
        capturedAccept = request.headers.get("Accept") ?? "";
        return HttpResponse.json(pivotResponse([]));
      }),
    );

    await fetchSerotypeDistribution(234);

    expect(capturedUrl).toContain("eq(taxon_lineage_ids,234)");
    expect(capturedUrl).toContain("pivot,(collection_year,serovar)");
    expect(capturedAccept).toBe("application/solr+json");
  });

  it("returns empty data when pivot is empty", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(pivotResponse([])),
      ),
    );

    await expect(fetchSerotypeDistribution(234)).resolves.toEqual({
      years: [],
      serovars: [],
    });
  });

  it("transforms pivot data into SerotypeDistributionData", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(
          pivotResponse([
            {
              value: 2023,
              pivot: [
                { value: "Sv1", count: 10 },
                { value: "Sv2", count: 5 },
              ],
            },
            {
              value: 2024,
              pivot: [
                { value: "Sv1", count: 20 },
                { value: "Sv3", count: 8 },
              ],
            },
          ]),
        ),
      ),
    );

    const result = await fetchSerotypeDistribution(1);

    // serovars ranked by total: Sv1=30, Sv3=8, Sv2=5
    expect(result.serovars).toEqual(["Sv1", "Sv3", "Sv2"]);
    expect(result.years).toEqual([
      { year: 2023, Sv1: 10, Sv2: 5, Sv3: 0 },
      { year: 2024, Sv1: 20, Sv2: 0, Sv3: 8 },
    ]);
  });

  it("filters to last 10 years based on max year in data", async () => {
    // years 2010..2025 — max is 2025, so only 2016..2025 should appear
    const rows = Array.from({ length: 16 }, (_, i) => ({
      value: 2010 + i,
      pivot: [{ value: "Sv1", count: i + 1 }],
    }));

    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(pivotResponse(rows)),
      ),
    );

    const result = await fetchSerotypeDistribution(1);

    const resultYears = result.years.map((y) => y.year);
    expect(resultYears).not.toContain(2015);
    expect(resultYears).toContain(2016);
    expect(resultYears).toContain(2025);
    expect(resultYears).toHaveLength(10);
  });

  it("limits serovars to top 10 by total count", async () => {
    // 12 distinct serovars
    const pivot = Array.from({ length: 12 }, (_, i) => ({
      value: `Sv${String(i + 1)}`,
      count: 12 - i, // Sv1=12, Sv2=11, ... Sv12=1
    }));

    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(
          pivotResponse([{ value: 2024, pivot }]),
        ),
      ),
    );

    const result = await fetchSerotypeDistribution(1);

    expect(result.serovars).toHaveLength(10);
    expect(result.serovars[0]).toBe("Sv1");
    expect(result.serovars).not.toContain("Sv11");
    expect(result.serovars).not.toContain("Sv12");
  });

  it("years are sorted ascending", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(
          pivotResponse([
            { value: 2022, pivot: [{ value: "Sv1", count: 1 }] },
            { value: 2020, pivot: [{ value: "Sv1", count: 1 }] },
            { value: 2021, pivot: [{ value: "Sv1", count: 1 }] },
          ]),
        ),
      ),
    );

    const result = await fetchSerotypeDistribution(1);
    expect(result.years.map((y) => y.year)).toEqual([2020, 2021, 2022]);
  });

  it("throws the original error message on non-ok response", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.text("upstream timeout", { status: 504 }),
      ),
    );

    await expect(fetchSerotypeDistribution(1)).rejects.toThrow(
      "Serotype Distribution: The BV-BRC data service is unavailable (HTTP 504 Gateway Timeout: upstream timeout).",
    );
  });

  it("coerces numeric years emitted as strings (application/solr+json)", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json(
          pivotResponse([
            { value: "2023", pivot: [{ value: "Sv1", count: 10 }] },
            { value: "2024", pivot: [{ value: "Sv1", count: 5 }] },
          ]),
        ),
      ),
    );

    const result = await fetchSerotypeDistribution(1);
    expect(result.years.map((y) => y.year)).toEqual([2023, 2024]);
  });

  it("propagates AbortSignal cancellation", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(pivotResponse([]));
      }),
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchSerotypeDistribution(1, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
