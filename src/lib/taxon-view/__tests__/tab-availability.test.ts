import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";

import {
  getSharedTabAvailability,
  parseTabAvailability,
  tabAvailabilityQueries,
} from "../tab-availability";

const dataApiOrigin = "https://data.test";

function envelope(numFound: number) {
  return { result: { response: { numFound, docs: [] } } };
}

describe("tabAvailabilityQueries", () => {
  it("builds one limit(1) lineage count per direct-field tab", () => {
    const queries = tabAvailabilityQueries(11118);
    expect(Object.keys(queries).sort()).toEqual([
      "epitopes",
      "experiments",
      "serology",
      "strains",
      "surveillance",
    ]);
    expect(queries.experiments).toEqual({
      dataType: "experiment",
      accept: "application/solr+json",
      query: "eq(taxon_lineage_ids,11118)&select(exp_id)&limit(1)",
    });
  });
});

describe("parseTabAvailability", () => {
  it("maps numFound to present / absent and anything unreadable to unknown", () => {
    expect(
      parseTabAvailability({
        epitopes: envelope(106402),
        experiments: envelope(0),
        strains: { result: {} },
        surveillance: null,
      }),
    ).toEqual({
      epitopes: "present",
      experiments: "absent",
      strains: "unknown",
      surveillance: "unknown",
      serology: "unknown",
    });
  });
});

describe("getSharedTabAvailability", () => {
  beforeEach(() => {
    process.env.DATA_API_URL = dataApiOrigin;
  });

  it("sends one anonymous batched query and returns the parsed statuses", async () => {
    let authorization: string | null = "unset";
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${dataApiOrigin}/query/`, async ({ request }) => {
        authorization = request.headers.get("authorization");
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          epitopes: envelope(5),
          experiments: envelope(0),
          strains: envelope(0),
          surveillance: envelope(2),
          serology: envelope(0),
        });
      }),
    );

    const availability = await getSharedTabAvailability(900001);

    expect(availability).toMatchObject({
      experiments: "absent",
      epitopes: "present",
    });
    expect(authorization).toBeNull();
    expect(Object.keys(body).sort()).toEqual([
      "epitopes",
      "experiments",
      "serology",
      "strains",
      "surveillance",
    ]);
  });

  it("returns null instead of rejecting when the upstream fails", async () => {
    server.use(
      http.post(`${dataApiOrigin}/query/`, () =>
        HttpResponse.json({ error: "down" }, { status: 503 }),
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getSharedTabAvailability(900002)).resolves.toBeNull();
  });
});
