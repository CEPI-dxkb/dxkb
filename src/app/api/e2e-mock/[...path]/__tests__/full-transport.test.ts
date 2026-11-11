import { NextRequest } from "next/server";
import { ServerDataRepository } from "@/lib/data-api/repository";
import {
  ambiguousSerologyRecords,
  ambiguousSurveillanceRecords,
  serologyRecord,
  surveillanceRecord,
} from "@/lib/e2e-fixtures/records";
import { resolveCompoundSample } from "@/lib/views/compound-sample";
import { makeRouteContext } from "@/test-helpers/api-route-helpers";
import { GET } from "../route";

/**
 * Runs the real repository's query through the real loopback handler, as built (`repository`) and after Next's `URLSearchParams` round trip (`next`).
 * Matching is strict in both: `sample%2F1` is not `sample/1`.
 */

type WireForm = "repository" | "next";

function normalizeLikeNext(url: URL): URL {
  const normalized = new URL(url.href);
  normalized.search = new URLSearchParams(url.search).toString();
  return normalized;
}

function loopbackFetch(wireForm: WireForm, seen?: string[]): typeof fetch {
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
    seen?.push(delivered.search);
    const path = delivered.pathname
      .replace(/^\/api\/e2e-mock\//, "")
      .split("/")
      .filter(Boolean);
    const response = await GET(
      new NextRequest(delivered.href, {
        method: "GET",
        headers: new Headers(init?.headers),
      }),
      makeRouteContext({ path }),
    );
    return response as unknown as Response;
  };
}

function repositoryFor(wireForm: WireForm, seen?: string[]) {
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
  function lookup(sampleIdentifier: string, discriminator?: string) {
    return resolveCompoundSample(repositoryFor(wireForm), {
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
    // A literal `%` survives as a malformed escape and falls back to raw text.
    await expect(lookup("50%")).resolves.toEqual({ status: "not-found" });
  });

  it("does NOT resolve a literal %2F identifier to the slash record", async () => {
    // Regression guard: an un-decoded route param asks for `sample%2F1`, which must be not-found.
    await expect(lookup("sample%2F1")).resolves.toEqual({
      status: "not-found",
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
  function lookup(sampleIdentifier: string, discriminator?: string) {
    return resolveCompoundSample(repositoryFor(wireForm), {
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
  // Guards the harness: a no-op `normalizeLikeNext` would silently re-run the `repository` case.
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
