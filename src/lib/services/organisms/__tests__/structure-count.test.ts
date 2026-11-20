import { http, HttpResponse } from "msw";

import {
  experimentalStructureRql,
  fetchExperimentalStructureCount,
} from "@/lib/services/organisms/structure-count";
import { organismJoinFetchTimeoutMs } from "@/lib/services/organisms/utils";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
  vi.restoreAllMocks();
});

const experimentalStructureQuery =
  "and(ne(method,Predicted),eq(genome_id,*),genome(and(eq(taxon_lineage_ids,2),ne(genome_status,Deprecated))))";

describe("experimentalStructureRql", () => {
  it("counts structures linked to a non-Deprecated genome of the taxon's lineage, like the Protein Structures tab", () => {
    expect(experimentalStructureRql(2)).toBe(experimentalStructureQuery);
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
    expect(seenQuery).toContain(experimentalStructureQuery);
    expect(seenQuery).toContain("limit(1)");
    expect(seenQuery).toContain("select(pdb_id)");
  });

  it("gives the cross-collection join the long fetch budget", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.json({ response: { numFound: 257, docs: [] } }),
      ),
    );

    await fetchExperimentalStructureCount(2);

    expect(timeoutSpy).toHaveBeenCalledWith(60_000);
    expect(timeoutSpy).toHaveBeenCalledWith(organismJoinFetchTimeoutMs);
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
