import { http, HttpResponse } from "msw";

import { fetchOrganismGeoDistribution } from "@/lib/services/organisms/geo-distribution";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

function fieldFacet(field: string, values: (string | number)[]) {
  return {
    response: { numFound: 100 },
    facet_counts: { facet_fields: { [field]: values } },
  };
}

interface PivotChild {
  value: string;
  count: number;
}

function pivotFacet(pivotKey: string, rows: { value: string; count: number; pivot: PivotChild[] }[]) {
  return {
    response: { numFound: 100 },
    facet_counts: {
      facet_pivot: {
        [pivotKey]: rows.map((row) => ({
          field: pivotKey.split(",")[0],
          value: row.value,
          count: row.count,
          pivot: row.pivot.map((p) => ({
            field: pivotKey.split(",")[1],
            value: p.value,
            count: p.count,
          })),
        })),
      },
    },
  };
}

interface PivotLeaf {
  value: string;
  count: number;
}

interface PivotMiddle {
  value: string;
  count: number;
  pivot: PivotLeaf[];
}

function pivot3Facet(pivotKey: string, rows: { value: string; count: number; pivot: PivotMiddle[] }[]) {
  const fields = pivotKey.split(",");
  return {
    response: { numFound: 100 },
    facet_counts: {
      facet_pivot: {
        [pivotKey]: rows.map((row) => ({
          field: fields[0],
          value: row.value,
          count: row.count,
          pivot: row.pivot.map((middle) => ({
            field: fields[1],
            value: middle.value,
            count: middle.count,
            pivot: middle.pivot.map((leaf) => ({
              field: fields[2],
              value: leaf.value,
              count: leaf.count,
            })),
          })),
        })),
      },
    },
  };
}

interface RouteOverrides {
  countryStatus?: number;
  stateStatus?: number;
  countyPivotStatus?: number;
  pivotStatus?: number;
}

function defaultGenomeRouter(overrides: RouteOverrides = {}) {
  return http.get(`${baseUrl}/genome/`, ({ request }) => {
    const query = new URL(request.url).search;
    if (query.includes("(field,isolation_country)")) {
      if (overrides.countryStatus) return HttpResponse.text("country failed", { status: overrides.countryStatus });
      return HttpResponse.json(fieldFacet("isolation_country", ["USA", 260, "China", 260, "Italy", 188]));
    }
    if (query.includes("(field,state_province)")) {
      if (overrides.stateStatus) return HttpResponse.text("state failed", { status: overrides.stateStatus });
      return HttpResponse.json(fieldFacet("state_province", ["Wyoming", 48, "Idaho", 35, "Texas", 24]));
    }
    if (query.includes("(pivot,(isolation_country,genus))")) {
      if (overrides.pivotStatus) return HttpResponse.text("pivot failed", { status: overrides.pivotStatus });
      return HttpResponse.json(
        pivotFacet("isolation_country,genus", [
          { value: "USA", count: 260, pivot: [{ value: "Brucella", count: 260 }] },
        ]),
      );
    }
    if (query.includes("(pivot,(isolation_country,host_common_name))")) {
      if (overrides.pivotStatus) return HttpResponse.text("pivot failed", { status: overrides.pivotStatus });
      return HttpResponse.json(
        pivotFacet("isolation_country,host_common_name", [
          { value: "USA", count: 260, pivot: [{ value: "Cattle", count: 120 }, { value: "Sheep", count: 80 }] },
        ]),
      );
    }
    if (query.includes("(pivot,(state_province,genus))")) {
      if (overrides.pivotStatus) return HttpResponse.text("pivot failed", { status: overrides.pivotStatus });
      return HttpResponse.json(
        pivotFacet("state_province,genus", [
          { value: "Wyoming", count: 48, pivot: [{ value: "Brucella", count: 48 }] },
        ]),
      );
    }
    if (query.includes("(pivot,(state_province,host_common_name))")) {
      if (overrides.pivotStatus) return HttpResponse.text("pivot failed", { status: overrides.pivotStatus });
      return HttpResponse.json(
        pivotFacet("state_province,host_common_name", [
          { value: "Wyoming", count: 48, pivot: [{ value: "Cattle", count: 30 }] },
        ]),
      );
    }
    if (query.includes("(pivot,(state_province,county))")) {
      if (overrides.countyPivotStatus) return HttpResponse.text("county failed", { status: overrides.countyPivotStatus });
      return HttpResponse.json(pivotFacet("state_province,county", [
        {
          value: "Wyoming",
          count: 48,
          pivot: [{ value: "Park", count: 30 }, { value: "Teton", count: 18 }],
        },
        {
          value: "Idaho",
          count: 35,
          pivot: [{ value: "Park", count: 35 }],
        },
      ]));
    }
    if (query.includes("(pivot,(state_province,county,genus))")) {
      if (overrides.pivotStatus) return HttpResponse.text("pivot failed", { status: overrides.pivotStatus });
      return HttpResponse.json(pivot3Facet("state_province,county,genus", [
        {
          value: "Wyoming",
          count: 48,
          pivot: [
            { value: "Park", count: 30, pivot: [{ value: "Brucella", count: 30 }] },
            { value: "Teton", count: 18, pivot: [{ value: "Brucella", count: 18 }] },
          ],
        },
      ]));
    }
    return HttpResponse.text("unknown facet query", { status: 400 });
  });
}

describe("fetchOrganismGeoDistribution", () => {
  it("aggregates country, state, county counts with full pivot metadata", async () => {
    server.use(defaultGenomeRouter());
    const result = await fetchOrganismGeoDistribution(234);

    expect(result.countryData).toEqual({ USA: 260, China: 260, Italy: 188 });
    expect(result.stateData).toEqual({ Wyoming: 48, Idaho: 35, Texas: 24 });
    expect(result.countyData).toEqual({ "Wyoming|Park": 30, "Wyoming|Teton": 18, "Idaho|Park": 35 });
    expect(result.countryMeta.USA).toEqual({
      count: 260,
      genera: { Brucella: 260 },
      hosts: { Cattle: 120, Sheep: 80 },
    });
    expect(result.stateMeta.Wyoming).toEqual({
      count: 48,
      genera: { Brucella: 48 },
      hosts: { Cattle: 30 },
    });
    expect(result.countyMeta["Wyoming|Park"]).toEqual({
      count: 30,
      genera: { Brucella: 30 },
      hosts: {},
    });
  });

  it("scopes county counts and genera by state so same-named counties in different states are kept separate", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const query = new URL(request.url).search;
        if (query.includes("(field,isolation_country)")) {
          return HttpResponse.json(fieldFacet("isolation_country", []));
        }
        if (query.includes("(field,state_province)")) {
          return HttpResponse.json(fieldFacet("state_province", []));
        }
        if (query.includes("(pivot,(state_province,county,genus))")) {
          return HttpResponse.json(pivot3Facet("state_province,county,genus", [
            {
              value: "Pennsylvania",
              count: 5,
              pivot: [{ value: "Washington", count: 5, pivot: [{ value: "Escherichia", count: 5 }] }],
            },
            {
              value: "Maryland",
              count: 2,
              pivot: [{ value: "Washington", count: 2, pivot: [{ value: "Salmonella", count: 2 }] }],
            },
          ]));
        }
        if (query.includes("(pivot,(state_province,county))")) {
          return HttpResponse.json(pivotFacet("state_province,county", [
            { value: "Pennsylvania", count: 5, pivot: [{ value: "Washington", count: 5 }] },
            { value: "Maryland", count: 2, pivot: [{ value: "Washington", count: 2 }] },
          ]));
        }
        if (query.includes("(pivot,")) {
          return HttpResponse.json({ response: { numFound: 0 }, facet_counts: { facet_pivot: {} } });
        }
        return HttpResponse.text("unknown", { status: 400 });
      }),
    );

    const result = await fetchOrganismGeoDistribution(234);
    expect(result.countyData["Pennsylvania|Washington"]).toBe(5);
    expect(result.countyData["Maryland|Washington"]).toBe(2);
    // A plain "Washington" key must not exist
    expect(result.countyData["Washington"]).toBeUndefined();
    // Genera must be state-scoped — same-named counties get different genera
    expect(result.countyMeta["Pennsylvania|Washington"].genera).toEqual({ Escherichia: 5 });
    expect(result.countyMeta["Maryland|Washington"].genera).toEqual({ Salmonella: 2 });
  });

  it("throws when a required field facet fails", async () => {
    server.use(defaultGenomeRouter({ stateStatus: 500 }));
    await expect(fetchOrganismGeoDistribution(234)).rejects.toThrow("state failed");
  });

  it("throws when the country facet fails", async () => {
    server.use(defaultGenomeRouter({ countryStatus: 502 }));
    await expect(fetchOrganismGeoDistribution(234)).rejects.toThrow("country failed");
  });

  it("returns empty meta objects when pivot facets fail without throwing", async () => {
    server.use(defaultGenomeRouter({ pivotStatus: 500 }));
    const result = await fetchOrganismGeoDistribution(234);

    expect(result.countryData).toEqual({ USA: 260, China: 260, Italy: 188 });
    expect(result.countryMeta.USA).toEqual({ count: 260, genera: {}, hosts: {} });
    expect(result.stateMeta.Wyoming).toEqual({ count: 48, genera: {}, hosts: {} });
  });

  it("re-throws AbortError from a pivot fetch instead of swallowing it", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const query = new URL(request.url).search;
        if (query.includes("(field,isolation_country)")) {
          return HttpResponse.json(fieldFacet("isolation_country", ["USA", 1]));
        }
        if (query.includes("(field,state_province)")) {
          return HttpResponse.json(fieldFacet("state_province", []));
        }
        // For pivots (including state_province,county), hang long enough to be cancellable.
        return new Promise<Response>((resolve) => {
          setTimeout(() => { resolve(HttpResponse.json({ response: { numFound: 0 }, facet_counts: { facet_pivot: {} } })); }, 1000);
        });
      }),
    );

    const controller = new AbortController();
    const promise = fetchOrganismGeoDistribution(234, { signal: controller.signal });
    // Allow the field fetches to start before we abort.
    queueMicrotask(() => { controller.abort(); });
    await expect(promise).rejects.toThrow();
  });

  it("returns empty maps when the taxon has no geographic data", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({
          response: { numFound: 0 },
          facet_counts: { facet_fields: { isolation_country: [], state_province: [] }, facet_pivot: { "state_province,county": [] } },
        }),
      ),
    );

    const result = await fetchOrganismGeoDistribution(234);
    expect(result.countryData).toEqual({});
    expect(result.stateData).toEqual({});
    expect(result.countyData).toEqual({});
  });
});
