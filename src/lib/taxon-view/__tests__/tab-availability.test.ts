import { http, HttpResponse } from "msw";

import type {
  OrganismLandingView,
  OrganismViewKey,
} from "@/components/organisms/types";
import { server } from "@/test-helpers/msw-server";

import {
  getSharedTabAvailability,
  parseTabAvailability,
  tabAvailabilityQueries,
} from "../tab-availability";
import { applyTabAvailability } from "../tab-policy";

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

describe("tabAvailabilityQueries and dataGateReasons", () => {
  it.each(Object.keys(tabAvailabilityQueries(1)))(
    "%s has a disabled reason when its probe finds no rows",
    (key) => {
      const view: OrganismLandingView = {
        key: key as OrganismViewKey,
        label: key,
        icon: null,
        Component: () => null,
      };

      const [result] = applyTabAvailability([view], { [view.key]: "absent" });

      expect(result.enabled).toBe(false);
      expect(result.disabledReason).toMatch(/^No .+ for this taxon\.$/);
    },
  );
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("returns null and logs the failure once when the upstream is in an outage", async () => {
    server.use(
      http.post(`${dataApiOrigin}/query/`, () =>
        HttpResponse.json({ error: "down" }, { status: 503 }),
      ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getSharedTabAvailability(900002)).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("taxonomy/900002: tab availability failed"),
      expect.anything(),
    );
  });

  // The repository maps a 400 to a 502 (an outage), so the failures that stay
  // outside `isUpstreamOutageError` are a kept 401/403/404/429 and a missing
  // DATA_API_URL.
  it("returns null and logs a 404 from the Data API, which is not an outage", async () => {
    server.use(
      http.post(`${dataApiOrigin}/query/`, () =>
        HttpResponse.json({ error: "not found" }, { status: 404 }),
      ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getSharedTabAvailability(900003)).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("taxonomy/900003: tab availability failed"),
      expect.anything(),
    );
  });

  it("returns null and logs a Data API that is not configured", async () => {
    delete process.env.DATA_API_URL;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getSharedTabAvailability(900004)).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("taxonomy/900004: tab availability failed"),
      expect.anything(),
    );
  });
});
