import { http, HttpResponse } from "msw";

import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import { fetchOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import {
  fetchOrganismSolrJson,
  responseErrorMessage,
} from "@/lib/services/organisms/utils";
import { server } from "@/test-helpers/msw-server";
import {
  maintenancePage,
  maintenancePageHtml,
  maintenanceSummary,
} from "@/test-helpers/upstream-failures";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

describe("responseErrorMessage", () => {
  it("reduces an HTML maintenance page to its status and title", async () => {
    await expect(responseErrorMessage(maintenancePage())).resolves.toBe(
      `503 Service Unavailable: ${maintenanceSummary}`,
    );
  });

  it("detects HTML without a content type", async () => {
    const message = await responseErrorMessage(
      new Response(maintenancePageHtml, { status: 503, statusText: "Service Unavailable" }),
    );
    expect(message).toBe(`503 Service Unavailable: ${maintenanceSummary}`);
  });

  it("keeps a plain-text body as the message", async () => {
    await expect(
      responseErrorMessage(new Response("undefined field genus", { status: 400 })),
    ).resolves.toBe("undefined field genus");
  });

  it("falls back to the status for an empty body", async () => {
    await expect(
      responseErrorMessage(new Response(null, { status: 502, statusText: "Bad Gateway" })),
    ).resolves.toBe("502 Bad Gateway");
  });
});

describe("organism loaders on a maintenance page", () => {
  beforeEach(() => {
    server.use(http.all(`${baseUrl}/*`, () => maintenancePage()));
  });

  it.each([
    ["fetchOrganismSolrJson", "genome isolation_country facet", () =>
      fetchOrganismSolrJson(`${baseUrl}/genome/`, "genome isolation_country facet")],
    ["fetchOrganismSummary", undefined, () => fetchOrganismSummary(562)],
    ["fetchOrganismTaxonomy", undefined, () => fetchOrganismTaxonomy(562)],
  ] as const)("%s never throws page source", async (_name, source, load) => {
    const error = await load().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).not.toContain("<");
    expect(message).toContain(`503 Service Unavailable: ${maintenanceSummary}`);
    if (source) expect(message.startsWith(`${source}: `)).toBe(true);
  });

  it("leaves a JSON body untouched", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.text('{"error":"bad"}', { status: 400 }),
      ),
    );
    await expect(fetchOrganismSolrJson(`${baseUrl}/genome/`, "genome facet")).rejects.toThrow(
      'genome facet: {"error":"bad"}',
    );
  });
});
