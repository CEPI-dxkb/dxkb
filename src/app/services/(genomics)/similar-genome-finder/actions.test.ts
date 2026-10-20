import { http, HttpResponse } from "msw";

import { setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { connectTimeout } from "@/test-helpers/upstream-failures";
import { submitSimilarGenomes } from "./actions";

const minhashUrl = "https://p3.theseed.test/services/minhash_service";
const websiteApi = "https://www.bv-brc.test/api";

const formData = {
  selectedGenomeId: "83332.12",
  fasta_file: "",
  output_path: "",
  output_file: "",
  max_pvalue: 1,
  max_distance: 1,
  max_hits: 50,
  include_bacterial: true,
  include_viral: false,
  scope: "reference" as const,
};

const minhashHit = () =>
  HttpResponse.json({
    result: [{ genome_id: "83332.12", distance: 0, pvalue: 0 }],
  });

beforeEach(() => {
  vi.stubEnv("MINHASH_SERVICE_URL", minhashUrl);
  vi.stubEnv("BVBRC_WEBSITE_API_URL", websiteApi);
  // The action used to loop back through this origin; it must not need it.
  vi.stubEnv("INTERNAL_API_ORIGIN", "");
  setTestSession({ token: "test-token" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("calls MinHash and the genome API directly, forwarding authentication", async () => {
  const requests: string[] = [];
  server.use(
    http.post(minhashUrl, ({ request }) => {
      requests.push(`minhash:${request.headers.get("Authorization") ?? ""}`);
      return minhashHit();
    }),
    http.post(`${websiteApi}/genome/`, async ({ request }) => {
      requests.push(
        `genome:${request.headers.get("Authorization") ?? ""}:${await request.text()}`,
      );
      return HttpResponse.json([
        {
          genome_id: "83332.12",
          genome_name: "Mycobacterium tuberculosis H37Rv",
          organism_name: "Mycobacterium tuberculosis",
        },
      ]);
    }),
  );

  await expect(submitSimilarGenomes(formData)).resolves.toEqual({
    success: true,
    rows: [
      expect.objectContaining({
        genome_id: "83332.12",
        genome_name: "Mycobacterium tuberculosis H37Rv",
      }),
    ],
  });
  expect(requests).toEqual([
    "minhash:test-token",
    `genome:test-token:${new URLSearchParams({ rows: "1", q: 'genome_id:("83332.12")' }).toString()}`,
  ]);
});

it("logs a missing setting by name but shows the user a reason without it", async () => {
  vi.stubEnv("MINHASH_SERVICE_URL", "");
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

  const response = await submitSimilarGenomes(formData);

  expect(response).toEqual({
    success: false,
    error:
      "Similar Genome Finder is unavailable right now: the search service is not configured on this server.",
  });
  expect(JSON.stringify(response)).not.toMatch(/MINHASH_SERVICE_URL|INTERNAL_API_ORIGIN/);
  expect(logged).toHaveBeenCalledWith(
    expect.stringContaining("MINHASH_SERVICE_URL"),
  );
});

it("names the MinHash service when it cannot be reached, and logs its host", async () => {
  const logged = vi.mocked(console.error);
  logged.mockClear();
  server.use(
    http.post(minhashUrl, () => {
      throw connectTimeout();
    }),
  );

  await expect(submitSimilarGenomes(formData)).resolves.toEqual({
    success: false,
    error:
      "The BV-BRC minhash service did not respond (connection timed out after 10 s).",
  });
  expect(logged).toHaveBeenCalledWith(
    "Similar Genome Finder search failed:",
    expect.objectContaining({ host: "p3.theseed.test" }),
  );
});

it("keeps the service's own error from a MinHash JSON-RPC error body", async () => {
  server.use(
    http.post(minhashUrl, () =>
      HttpResponse.json({ error: { message: "genome 83332.12 not found" } }),
    ),
  );

  await expect(submitSimilarGenomes(formData)).resolves.toEqual({
    success: false,
    error: "genome 83332.12 not found",
  });
});

it("keeps the hits and says why names are missing when the genome lookup fails", async () => {
  server.use(
    http.post(minhashUrl, minhashHit),
    http.post(`${websiteApi}/genome/`, () =>
      HttpResponse.text("upstream down", {
        status: 503,
        statusText: "Service Unavailable",
      }),
    ),
  );

  const response = await submitSimilarGenomes(formData);

  expect(response).toEqual({
    success: true,
    rows: [expect.objectContaining({ genome_id: "83332.12", genome_name: "" })],
    genomeDetailsError:
      "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: upstream down).",
  });
});

it("returns the sign-in reason when there is no session", async () => {
  const { clearTestCookies } = await import("@/test-helpers/api-route-helpers");
  clearTestCookies();

  await expect(submitSimilarGenomes(formData)).resolves.toEqual({
    success: false,
    error: "Authentication required",
  });
});
