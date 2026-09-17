import { NextRequest } from "next/server";
import { ServerDataRepository } from "@/lib/data-api/repository";
import {
  ambiguousSerologyRecords,
  ambiguousSurveillanceRecords,
  serologyRecord,
  surveillanceRecord,
} from "@/lib/e2e-fixtures/records";
import { resolveCompoundSample } from "@/lib/views/compound-sample";
import { GET } from "../route";

/**
 * Full-transport coverage for the compound-sample lookups whose identifiers
 * carry reserved characters.
 *
 * The query is built by the REAL `ServerDataRepository` (so `serializeValue`
 * and `URL.search` assignment are exercised, not a hand-written string) and
 * answered by the REAL loopback GET handler. Each case runs twice:
 *
 *   - `repository` — the search string the repository puts on the wire.
 *   - `next` — the same query after the `URLSearchParams` round trip Next
 *     applies to every route-handler request, which re-encodes `(` `)` `,`,
 *     turns spaces into `+`, and (when a page component's dynamic `params`
 *     segment was still percent-encoded) leaves the value one encode deeper.
 *
 * The second form is the one that regressed: a single global
 * `decodeURIComponent` over the search string left `sample%2F1` where the
 * matcher expected `sample/1`, so `/surveillance/sample%2F1` rendered
 * "Surveillance record not found" from an empty result.
 */

type WireForm = "repository" | "next";

function normalizeLikeNext(url: URL): URL {
  const normalized = new URL(url.href);
  normalized.search = new URLSearchParams(url.search).toString();
  return normalized;
}

function loopbackFetch(wireForm: WireForm, seen: string[]): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const requested = new URL(
      input instanceof URL
        ? input.href
        : typeof input === "string"
          ? input
          : input.url,
    );
    const delivered =
      wireForm === "next" ? normalizeLikeNext(requested) : requested;
    seen.push(delivered.search);
    const path = delivered.pathname
      .replace(/^\/api\/e2e-mock\//, "")
      .split("/")
      .filter(Boolean);
    const response = await GET(
      new NextRequest(delivered.href, {
        method: "GET",
        headers: new Headers(init?.headers),
      }),
      { params: Promise.resolve({ path }) },
    );
    return response as unknown as Response;
  };
}

function repositoryFor(wireForm: WireForm, seen: string[]) {
  return new ServerDataRepository({
    baseUrl: "http://127.0.0.1:3020/api/e2e-mock/data",
    fetch: loopbackFetch(wireForm, seen),
  });
}

const wireForms: WireForm[] = ["repository", "next"];
const originalMockEnabled = process.env.E2E_MOCK_ENABLED;

beforeEach(() => {
  process.env.E2E_MOCK_ENABLED = "1";
});

afterEach(() => {
  if (originalMockEnabled === undefined) delete process.env.E2E_MOCK_ENABLED;
  else process.env.E2E_MOCK_ENABLED = originalMockEnabled;
});

describe.each(wireForms)("surveillance over the %s wire form", (wireForm) => {
  const seen: string[] = [];

  function lookup(sampleIdentifier: string, discriminator?: string) {
    return resolveCompoundSample(repositoryFor(wireForm, seen), {
      resource: "surveillance",
      sampleIdentifier,
      discriminatorField: "pathogen_test_type",
      discriminator,
      parseRecord: (row) => row as unknown as { sample_identifier: string },
    });
  }

  it("resolves the slash identifier with its slash discriminator", async () => {
    await expect(lookup("sample/1", "RAT/antigen")).resolves.toEqual({
      status: "unique",
      record: expect.objectContaining({
        id: surveillanceRecord.id,
        sample_identifier: "sample/1",
      }) as unknown,
    });
  });

  it("resolves the slash identifier with no discriminator", async () => {
    await expect(lookup("sample/1")).resolves.toMatchObject({
      status: "unique",
    });
  });

  it("does not resolve an unrelated percent-bearing identifier", async () => {
    // A literal `%` survives the round trip as a malformed escape and falls
    // back to its raw text, so it stays a distinct identifier rather than
    // collapsing onto any fixture.
    await expect(lookup("50%")).resolves.toEqual({ status: "not-found" });
  });

  it("treats a literal %2F identifier as the slash one — documented collision", async () => {
    // The `URLSearchParams` round trip Next applies makes `sample%2F1` and
    // `sample/1` the same bytes on arrival, so no parser can separate them.
    // This is load-bearing rather than incidental: Next hands the page
    // component a still-encoded `params.sampleId`, so `/surveillance/sample%2F1`
    // asks for `sample%2F1` and must still find `sample/1`. Pinned here so a
    // future "stricter decode" cannot silently break that page again.
    await expect(lookup("sample%2F1")).resolves.toMatchObject({
      status: "unique",
      record: expect.objectContaining({
        sample_identifier: "sample/1",
      }) as unknown,
    });
  });

  it("filters the ambiguous sample by its slash-bearing discriminator", async () => {
    await expect(lookup("ambiguous-sample", "RAT/antigen")).resolves.toEqual({
      status: "unique",
      record: expect.objectContaining({
        id: ambiguousSurveillanceRecords[1].id,
      }) as unknown,
    });
  });

  it("reports both discriminators when none is supplied", async () => {
    await expect(lookup("ambiguous-sample")).resolves.toEqual({
      status: "ambiguous",
      discriminatorValues: ["PCR", "RAT/antigen"],
    });
  });
});

describe.each(wireForms)("serology over the %s wire form", (wireForm) => {
  const seen: string[] = [];

  function lookup(sampleIdentifier: string, discriminator?: string) {
    return resolveCompoundSample(repositoryFor(wireForm, seen), {
      resource: "serology",
      sampleIdentifier,
      discriminatorField: "test_type",
      discriminator,
      parseRecord: (row) => row as unknown as { sample_identifier: string },
    });
  }

  it("resolves the plain identifier", async () => {
    await expect(lookup(serologyRecord.sample_identifier)).resolves.toEqual({
      status: "unique",
      record: expect.objectContaining({ id: serologyRecord.id }) as unknown,
    });
  });

  it("filters the ambiguous sample by its slash-bearing test type", async () => {
    await expect(
      lookup("ambiguous-serology", "ELISA/IgG test"),
    ).resolves.toEqual({
      status: "unique",
      record: expect.objectContaining({
        id: ambiguousSerologyRecords[1].id,
      }) as unknown,
    });
  });

  it("returns not-found for an unmatched test type rather than a wrong row", async () => {
    await expect(lookup("ambiguous-serology", "LAMP")).resolves.toEqual({
      status: "not-found",
    });
  });

  it("does not resolve a literal-percent identifier to a real record", async () => {
    await expect(lookup("000123%")).resolves.toEqual({ status: "not-found" });
  });
});

describe("the two wire forms are genuinely different strings", () => {
  // Guards the test harness itself: if `normalizeLikeNext` ever became a
  // no-op, every `next` case above would silently re-run the `repository`
  // case and the regression this file exists for would go uncovered.
  it("normalizes the repository's search string", async () => {
    const repositorySearches: string[] = [];
    const nextSearches: string[] = [];
    for (const [wireForm, seen] of [
      ["repository", repositorySearches],
      ["next", nextSearches],
    ] as const) {
      await resolveCompoundSample(repositoryFor(wireForm, seen), {
        resource: "surveillance",
        sampleIdentifier: "sample/1",
        discriminatorField: "pathogen_test_type",
        discriminator: "RAT/antigen",
        parseRecord: (row) => row as unknown as { sample_identifier: string },
      });
    }

    expect(repositorySearches[0]).toContain("eq(sample_identifier,sample%2F1)");
    expect(nextSearches[0]).toContain("eq%28sample_identifier%2Csample%2F1%29");
    expect(nextSearches[0]).not.toEqual(repositorySearches[0]);
  });
});
