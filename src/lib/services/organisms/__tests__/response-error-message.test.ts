import { http } from "msw";

import { UpstreamError } from "@/lib/api/upstream-failure";
import { fetchAmrPhenotypeDistribution } from "@/lib/services/organisms/amr-distribution";
import { fetchOrganismGenera } from "@/lib/services/organisms/genera";
import { fetchOrganismMetadataFacets } from "@/lib/services/organisms/metadata-facets";
import { fetchReferenceGenomes } from "@/lib/services/organisms/reference-genomes";
import { fetchSerotypeDistribution } from "@/lib/services/organisms/serotype-distribution";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import { fetchTaxonomicDistribution } from "@/lib/services/organisms/taxonomic-distribution";
import { fetchOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import {
  organismResponseError,
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

describe("organismResponseError", () => {
  const isolationCountry = {
    source: "genome isolation_country facet",
    label: "Isolation Country",
  };

  /** A real fetch answered by `answer`, so the response has a URL. */
  async function answeredWith(answer: () => Response): Promise<Response> {
    server.use(http.get(`${baseUrl}/genome/`, answer));
    return fetch(`${baseUrl}/genome/`);
  }

  it("phrases a maintenance page as every backend does, behind the label", async () => {
    const error = await organismResponseError(
      await answeredWith(() => maintenancePage()),
      isolationCountry,
    );

    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({
      status: 503,
      code: "service_unavailable",
      message: `Isolation Country: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
      // For the server log only.
      source: "genome isolation_country facet",
      host: "bvbrc.test",
    });
    expect(error.message).not.toContain("<");
    expect(error.message).not.toContain("bvbrc.test");
    expect(error.message).not.toContain("isolation_country");
  });

  it("leaves the label out of a request that has none", async () => {
    const error = await organismResponseError(
      await answeredWith(
        () => new Response(null, { status: 504, statusText: "Gateway Timeout" }),
      ),
      { source: "summary_by_taxon" },
    );

    expect(error).toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC data service is unavailable (HTTP 504 Gateway Timeout).",
      source: "summary_by_taxon",
    });
  });

  it("keeps a plain-text body, condensed to one line", async () => {
    const error = await organismResponseError(
      await answeredWith(
        () =>
          new Response("undefined field genus\n  at SolrQuery", {
            status: 500,
            statusText: "Internal Server Error",
          }),
      ),
      isolationCountry,
    );

    expect(error).toMatchObject({
      status: 502,
      code: "upstream_error",
      message:
        "Isolation Country: The BV-BRC data service is unavailable (HTTP 500 Internal Server Error: undefined field genus at SolrQuery).",
    });
  });

  it("keeps only a JSON error's message, and says a 4xx was rejected", async () => {
    const error = await organismResponseError(
      await answeredWith(
        () =>
          new Response('{"error":"bad query"}', {
            status: 400,
            statusText: "Bad Request",
            headers: { "Content-Type": "application/json" },
          }),
      ),
      isolationCountry,
    );

    expect(error).toMatchObject({
      status: 400,
      code: "upstream_error",
      message:
        "Isolation Country: The BV-BRC data service rejected the request (HTTP 400 Bad Request: bad query).",
    });
  });
});

describe("organism loaders on a maintenance page", () => {
  beforeEach(() => {
    server.use(http.all(`${baseUrl}/*`, () => maintenancePage()));
  });

  const unavailable = `The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`;

  it.each([
    // Unlabelled: the card or page showing the failure already names the data.
    ["fetchOrganismSummary", "", "summary_by_taxon", () => fetchOrganismSummary(562)],
    ["fetchOrganismTaxonomy", "", "taxonomy/562", () => fetchOrganismTaxonomy(562)],
    ["fetchOrganismGenera", "", "genome genus facet", () => fetchOrganismGenera(562)],
    ["fetchReferenceGenomes", "", "reference-genomes", () => fetchReferenceGenomes(562)],
    // Labelled with the title of the chart that shows the failure.
    ["fetchOrganismMetadataFacets", "Isolation Country: ", "genome isolation_country facet", () =>
      fetchOrganismMetadataFacets(562, ["isolation_country"])],
    ["fetchTaxonomicDistribution", "Taxonomic Distribution: ", "taxonomic distribution genus", () =>
      fetchTaxonomicDistribution(562)],
    ["fetchAmrPhenotypeDistribution", "Antimicrobial Resistance Profile: ", "genome_amr phenotype pivot", () =>
      fetchAmrPhenotypeDistribution(562)],
    ["fetchSerotypeDistribution", "Serotype Distribution: ", "genome collection_year,serovar pivot", () =>
      fetchSerotypeDistribution(562)],
  ] as const)(
    "%s says the data service is unavailable, never its endpoint or page source",
    async (_name, prefix, source, load) => {
      const error = await load().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({
        status: 503,
        code: "service_unavailable",
        message: `${prefix}${unavailable}`,
        source,
        host: "bvbrc.test",
      });
    },
  );
});
