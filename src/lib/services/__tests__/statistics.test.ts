import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/test-helpers/msw-server";
import {
  connectTimeout,
  maintenancePage,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";
import { upstreamTimeoutMs } from "@/lib/api/upstream-failure";
import {
  dbStatisticsDefinitions,
  fetchDbStatistics,
  type StatisticKey,
} from "@/lib/services/statistics";

const dataApi = "https://data-api.test";

beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_API = dataApi;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DATA_API;
  vi.restoreAllMocks();
});

function solrCount(numFound: number) {
  return HttpResponse.json({ response: { numFound, docs: [] } });
}

function mockAllCores(countByCore: Partial<Record<string, number>>, fallback = 0) {
  server.use(
    http.get(`${dataApi}/:core/`, ({ params }) => {
      const core = params.core as string;
      const value = countByCore[core] ?? fallback;
      return solrCount(value);
    }),
  );
}

describe("fetchDbStatistics", () => {
  it("returns numeric counts for all 8 stats on the happy path", async () => {
    mockAllCores({
      genome: 100,
      genome_feature: 200,
      taxonomy: 300,
      epitope: 400,
      protein_structure: 500,
      protein_feature: 600,
    });

    const { counts, unavailableReason } = await fetchDbStatistics();

    expect(unavailableReason).toBeNull();
    const expectedKeys: StatisticKey[] = [
      "viralGenomes",
      "proteinEntries",
      "virusSpecies",
      "epitopes",
      "taxons",
      "proteinStructures",
      "proteinFeatures",
      "genomes",
    ];
    for (const key of expectedKeys) {
      expect(typeof counts[key]).toBe("number");
    }
    expect(counts.proteinStructures).toBe(500);
    expect(counts.proteinFeatures).toBe(600);
  });

  it("returns null for a single failed metric and numbers for the rest", async () => {
    server.use(
      http.get(`${dataApi}/protein_structure/`, () =>
        HttpResponse.text("upstream exploded", { status: 500 }),
      ),
      http.get(`${dataApi}/:core/`, () => solrCount(42)),
    );

    const { counts, unavailableReason } = await fetchDbStatistics();

    expect(unavailableReason).toBeNull();
    expect(counts.proteinStructures).toBeNull();
    expect(counts.viralGenomes).toBe(42);
    expect(counts.genomes).toBe(42);
  });

  it("returns null for every metric when all requests fail and never throws", async () => {
    server.use(
      http.get(`${dataApi}/:core/`, () =>
        HttpResponse.text("everything is on fire", { status: 503 }),
      ),
    );

    const { counts, unavailableReason } = await fetchDbStatistics();

    for (const value of Object.values(counts)) {
      expect(value).toBeNull();
    }
    expect(unavailableReason).toContain("everything is on fire");
  });

  it("applies the shared Data API budget while preserving a caller abort signal", async () => {
    const callerSignal = new AbortController().signal;
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
    const anySpy = vi.spyOn(AbortSignal, "any").mockReturnValue(callerSignal);
    mockAllCores({}, 1);

    await fetchDbStatistics({ signal: callerSignal });

    expect(timeoutSpy).toHaveBeenCalledTimes(dbStatisticsDefinitions.length);
    expect(timeoutSpy).toHaveBeenCalledWith(upstreamTimeoutMs.dataApi);
    expect(anySpy).toHaveBeenCalledWith([callerSignal, timeoutSignal]);
  });

  it("names the Data API budget when a slow count runs out of time", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    shortenTimeouts();
    server.use(
      http.get(`${dataApi}/genome_feature/`, neverRespond),
      http.get(`${dataApi}/:core/`, () => solrCount(1)),
    );

    const { counts, unavailableReason } = await fetchDbStatistics();

    expect(unavailableReason).toBeNull();
    expect(counts.proteinEntries).toBeNull();
    expect(counts.genomes).toBe(1);
    expect(errorSpy.mock.calls.flat().join(" ")).toContain(
      "BV-BRC count failed for genome_feature: The BV-BRC data service did not respond (timed out after 20 s).",
    );
  });

  it("logs the original upstream error message verbatim", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.get(`${dataApi}/protein_structure/`, () =>
        HttpResponse.text("BV-BRC overloaded — try again", { status: 503 }),
      ),
      http.get(`${dataApi}/:core/`, () => solrCount(1)),
    );

    await fetchDbStatistics();

    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("BV-BRC overloaded — try again");
    expect(logged).toContain("protein_structure");
  });

  it("encodes the viral-genome request with the correct filter, limit, and accept header", async () => {
    const capturedUrls: string[] = [];
    const capturedAccepts: string[] = [];
    server.use(
      http.get(`${dataApi}/genome/`, ({ request }) => {
        capturedUrls.push(request.url);
        capturedAccepts.push(request.headers.get("accept") ?? "");
        return solrCount(7);
      }),
      http.get(`${dataApi}/:core/`, () => solrCount(0)),
    );

    await fetchDbStatistics();

    const filteredUrl = capturedUrls.find((u) => u.includes("eq(superkingdom,Viruses)"));
    expect(filteredUrl).toBeDefined();
    expect(filteredUrl).toContain("/genome/");
    expect(filteredUrl).toContain("limit(1)");
    expect(capturedAccepts.every((a) => a === "application/solr+json")).toBe(true);
  });

  it("reduces a maintenance page to its title in the reason and the log, never its markup", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(http.get(`${dataApi}/:core/`, () => maintenancePage()));

    const { counts, unavailableReason } = await fetchDbStatistics();

    expect(counts.genomes).toBeNull();
    expect(unavailableReason).toBe(
      `The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
    );
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain(maintenanceSummary);
    expect(logged).not.toContain("<");
    expect(logged).not.toContain("text-align");
  });

  it("names the data service when a count cannot connect", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.get(`${dataApi}/:core/`, () => {
        throw connectTimeout();
      }),
    );

    const { unavailableReason } = await fetchDbStatistics();

    expect(unavailableReason).toMatch(
      /^The BV-BRC data service did not respond \(connection timed out/,
    );
  });

  it("freezes the definitions array so consumers cannot mutate it", () => {
    expect(Object.isFrozen(dbStatisticsDefinitions)).toBe(true);
    expect(dbStatisticsDefinitions).toHaveLength(8);
    const keys = dbStatisticsDefinitions.map((d) => d.key);
    expect(keys).toEqual([
      "viralGenomes",
      "proteinEntries",
      "virusSpecies",
      "epitopes",
      "taxons",
      "proteinStructures",
      "proteinFeatures",
      "genomes",
    ]);
  });
});
