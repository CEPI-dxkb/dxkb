import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";

import { POST as genomeByIds } from "@/app/api/services/genome/by-ids/route";
import { GET as genomeSearch } from "@/app/api/services/genome/search/route";
import { mockNextRequest, setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import {
  connectTimeout,
  maintenancePage,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";

const dataApi = "https://p3.theseed.test/services/data_api";

beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_API = dataApi;
  setTestSession();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DATA_API;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const searchRequest = () =>
  mockNextRequest({
    url: "http://localhost:3019/api/services/genome/search",
    searchParams: { q: "Escherichia" },
  });

describe("genome search and lookup on an upstream outage", () => {
  it("search answers a connect timeout with 504 instead of a bare 'fetch failed'", async () => {
    server.use(
      http.get(`${dataApi}/genome/`, () => {
        throw connectTimeout();
      }),
    );

    const response = await genomeSearch(searchRequest(), {});
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error:
        "The BV-BRC data service did not respond (connection timed out after 10 s).",
      code: "upstream",
    });
  });

  it("search gives up after its budget", async () => {
    shortenTimeouts();
    server.use(http.get(`${dataApi}/genome/`, neverRespond));

    const response = await genomeSearch(searchRequest(), {});
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: "The BV-BRC data service did not respond (timed out after 20 s).",
    });
  });

  it("by-ids keeps the upstream status for a 503 page without forwarding HTML", async () => {
    server.use(http.get(`${dataApi}/genome/`, () => maintenancePage()));

    const response = await genomeByIds(
      mockNextRequest({ method: "POST", body: { genome_ids: ["83332.12"] } }),
      {},
    );
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      error: "BV-BRC genome lookup failed: 503 Service Unavailable",
    });
    expect(text).not.toContain("<");
  });
});

describe("POST /api/services/minhash on an upstream outage", () => {
  const minhashUrl = "https://p3.theseed.test/services/minhash_service";

  async function loadRoute() {
    vi.resetModules();
    vi.stubEnv("MINHASH_SERVICE_URL", minhashUrl);
    return (await import("@/app/api/services/minhash/route")).POST;
  }

  const minhashRequest = () =>
    new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "Minhash.compute_genome_distance_for_genome2" }),
    });

  it("describes a 503 maintenance page by its title, not as 'Minhash service error'", async () => {
    const POST = await loadRoute();
    server.use(http.post(minhashUrl, () => maintenancePage()));

    const response = await POST(minhashRequest(), {});
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: `The BV-BRC minhash service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
    });
  });

  it("still forwards a JSON error body", async () => {
    const POST = await loadRoute();
    server.use(
      http.post(minhashUrl, () => HttpResponse.json({ error: "bad genome" }, { status: 400 })),
    );

    const response = await POST(minhashRequest(), {});
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad genome" });
  });

  it("gives up after its budget", async () => {
    const POST = await loadRoute();
    shortenTimeouts();
    server.use(http.post(minhashUrl, neverRespond));

    const response = await POST(minhashRequest(), {});
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error:
        "The BV-BRC minhash service did not respond (timed out after 60 s).",
      code: "upstream",
    });
  });
});
