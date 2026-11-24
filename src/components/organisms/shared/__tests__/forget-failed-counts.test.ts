import { http, HttpResponse } from "msw";

import { forgetFailedCounts } from "../forget-failed-counts";
import { getSharedExperimentalStructureCount } from "@/lib/services/organisms/structure-count";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

function requestedTaxon(request: Request): number {
  const search = decodeURIComponent(new URL(request.url).search);
  return Number(/eq\(taxon_lineage_ids,(\d+)\)/.exec(search)?.[1]);
}

/**
 * Answers the structure count with each taxon's queued replies in order,
 * recording every request: a count; "failed", a fast 500 (cached as an
 * outage, but not one that trips the breaker); or "outage", a 503 (which
 * does, two within 60 s opening it).
 */
function serveStructureCounts(
  replies: Partial<Record<number, (number | "failed" | "outage")[]>>,
) {
  const requests: { taxonId: number; authorization: string | null }[] = [];
  server.use(
    http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
      const taxonId = requestedTaxon(request);
      requests.push({
        taxonId,
        authorization: request.headers.get("Authorization"),
      });
      const reply = replies[taxonId]?.shift();
      if (typeof reply === "number") {
        return HttpResponse.json({ response: { numFound: reply, docs: [] } });
      }
      return reply === "outage"
        ? HttpResponse.text("BV-BRC overloaded", { status: 503 })
        : HttpResponse.text("Solr query failed", { status: 500 });
    }),
  );
  return requests;
}

describe("forgetFailedCounts", () => {
  it("makes the next read of a failed PDB count ask the upstream again", async () => {
    const requests = serveStructureCounts({ 9100001: ["failed", 42] });

    await expect(getSharedExperimentalStructureCount(9100001)).rejects.toThrow(
      "Solr query failed",
    );
    // Without the forget, the cached outage is served for 60 s.
    await expect(getSharedExperimentalStructureCount(9100001)).rejects.toThrow(
      "Solr query failed",
    );
    expect(requests).toHaveLength(1);

    await forgetFailedCounts([9100001]);

    await expect(getSharedExperimentalStructureCount(9100001)).resolves.toBe(42);
    expect(requests).toHaveLength(2);
  });

  it("forgets every listed root, as All Organisms needs", async () => {
    const requests = serveStructureCounts({
      9100002: ["failed", 5],
      9100003: ["failed", 7],
    });
    await expect(getSharedExperimentalStructureCount(9100002)).rejects.toThrow();
    await expect(getSharedExperimentalStructureCount(9100003)).rejects.toThrow();

    await forgetFailedCounts([9100002, 9100003]);

    await expect(getSharedExperimentalStructureCount(9100002)).resolves.toBe(5);
    await expect(getSharedExperimentalStructureCount(9100003)).resolves.toBe(7);
    expect(requests).toHaveLength(4);
  });

  it("never drops a cached count that loaded", async () => {
    const requests = serveStructureCounts({ 9100004: [257] });
    await expect(getSharedExperimentalStructureCount(9100004)).resolves.toBe(257);

    await forgetFailedCounts([9100004]);

    await expect(getSharedExperimentalStructureCount(9100004)).resolves.toBe(257);
    await settleBackgroundWork();
    expect(requests).toHaveLength(1);
  });

  it("forgets a taxon's failure at most once per 10 s, so retries cannot hammer the join", async () => {
    const requests = serveStructureCounts({ 9100005: ["failed", "failed", 9] });
    await expect(getSharedExperimentalStructureCount(9100005)).rejects.toThrow();
    await forgetFailedCounts([9100005]);
    await expect(getSharedExperimentalStructureCount(9100005)).rejects.toThrow();
    expect(requests).toHaveLength(2);

    advance(9_999);
    await forgetFailedCounts([9100005]);
    await expect(getSharedExperimentalStructureCount(9100005)).rejects.toThrow();
    await settleBackgroundWork();
    expect(requests).toHaveLength(2);

    advance(1);
    await forgetFailedCounts([9100005]);
    await expect(getSharedExperimentalStructureCount(9100005)).resolves.toBe(9);
    expect(requests).toHaveLength(3);
  });

  it("leaves an open breaker alone: a forgotten count still fails fast without asking the upstream", async () => {
    const requests = serveStructureCounts({
      9100007: ["outage", 1],
      9100008: ["outage", 2],
    });
    await expect(getSharedExperimentalStructureCount(9100007)).rejects.toThrow(
      "BV-BRC overloaded",
    );
    // The second outage within 60 s opens the breaker for 30 s.
    await expect(getSharedExperimentalStructureCount(9100008)).rejects.toThrow(
      "BV-BRC overloaded",
    );

    await forgetFailedCounts([9100007, 9100008]);

    await expect(getSharedExperimentalStructureCount(9100007)).rejects.toThrow(
      "BV-BRC overloaded",
    );
    expect(requests).toHaveLength(2);
  });

  it("reads no session: the reload it allows sends no token", async () => {
    setTestSession({ token: "user-token", userId: "chrescobar" });
    const requests = serveStructureCounts({ 9100006: ["failed", 3] });
    await expect(getSharedExperimentalStructureCount(9100006)).rejects.toThrow();

    await forgetFailedCounts([9100006]);
    await expect(getSharedExperimentalStructureCount(9100006)).resolves.toBe(3);

    expect(requests.map((request) => request.authorization)).toEqual([
      null,
      null,
    ]);
  });

  // Each bad input names the seeded taxon where it can, so a partial forget
  // before the validation failed would show as a new upstream request.
  it.each([
    ["no ids", []],
    ["a zero id", [9100009, 0]],
    ["a negative id", [9100009, -2]],
    ["a fractional id", [9100009, 1.5]],
    ["a string id", ["9100009"]],
    ["more than four ids", [9100009, 2, 3, 4, 5]],
    ["something other than a list", "9100009"],
  ])("rejects %s without touching the cache", async (_label, taxonIds) => {
    const requests = serveStructureCounts({ 9100009: ["failed", 42] });
    await expect(getSharedExperimentalStructureCount(9100009)).rejects.toThrow(
      "Solr query failed",
    );

    await expect(forgetFailedCounts(taxonIds)).rejects.toThrow(
      /Retry needs 1 to 4 positive integer taxon ids/,
    );

    // Still the cached failure, served without asking the upstream again.
    await expect(getSharedExperimentalStructureCount(9100009)).rejects.toThrow(
      "Solr query failed",
    );
    await settleBackgroundWork();
    expect(requests).toHaveLength(1);
  });
});
