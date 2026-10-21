import { http, HttpResponse } from "msw";

import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { server } from "@/test-helpers/msw-server";
import { maintenancePage } from "@/test-helpers/upstream-failures";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

describe("fetchTaxonGenomeCount", () => {
  it("counts the lineage's genomes less the Deprecated ones", async () => {
    const capturedUrls: string[] = [];
    const capturedAccepts: string[] = [];
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        capturedUrls.push(decodeURIComponent(request.url));
        capturedAccepts.push(request.headers.get("accept") ?? "");
        return HttpResponse.json({ response: { numFound: 1617890, docs: [] } });
      }),
    );

    await expect(fetchTaxonGenomeCount(11320)).resolves.toBe(1617890);
    expect(capturedAccepts).toEqual(["application/solr+json"]);
    expect(capturedUrls[0]).toContain(
      "and(eq(taxon_lineage_ids,11320),ne(genome_status,Deprecated))",
    );
    expect(capturedUrls[0]).toContain("limit(1)");
  });

  it("sends no Authorization for an anonymous count", async () => {
    const authorizations: (string | null)[] = [];
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        authorizations.push(request.headers.get("authorization"));
        return HttpResponse.json({ response: { numFound: 1896, docs: [] } });
      }),
    );

    await expect(fetchTaxonGenomeCount(234)).resolves.toBe(1896);
    expect(authorizations).toEqual([null]);
  });

  it("counts a signed-in user's private genomes through their token", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) =>
        HttpResponse.json({
          response: {
            numFound:
              request.headers.get("authorization") === "user-token" ? 1906 : 1896,
            docs: [],
          },
        }),
      ),
    );

    await expect(fetchTaxonGenomeCount(234, { token: "user-token" })).resolves.toBe(
      1906,
    );
  });

  it("never caches a signed-in count, so one user's private genomes never reach another", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ response: { numFound: 1906, docs: [] } }),
      ),
    );

    await fetchTaxonGenomeCount(234, { token: "user-token" });
    await fetchTaxonGenomeCount(234);

    const [signedIn, anonymous] = fetchSpy.mock.calls.map(([, init]) => init);
    expect(signedIn).toEqual(
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    );
    expect(signedIn).not.toHaveProperty("next");
    expect(anonymous).toEqual(
      expect.objectContaining({ next: { revalidate: 86400 } }),
    );
  });

  it("never sends a token over plain HTTP", async () => {
    process.env.BVBRC_WEBSITE_API_URL = "http://bvbrc.test/api-for-website";
    let requested = false;
    server.use(
      http.get("http://bvbrc.test/api-for-website/genome/", () => {
        requested = true;
        return HttpResponse.json({ response: { numFound: 1, docs: [] } });
      }),
    );

    await expect(fetchTaxonGenomeCount(234, { token: "user-token" })).rejects.toThrow(
      "Authenticated data service requests require HTTPS.",
    );
    expect(requested).toBe(false);
  });

  it("rejects a payload without response.numFound", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () => HttpResponse.json({ response: {} })),
    );

    await expect(fetchTaxonGenomeCount(11320)).rejects.toThrow(
      "missing response.numFound",
    );
  });

  it("keeps the upstream cause of a failed count", async () => {
    server.use(http.get(`${baseUrl}/genome/`, () => maintenancePage()));

    await expect(fetchTaxonGenomeCount(11320)).rejects.toThrow(/503/);
  });
});
