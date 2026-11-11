// `server-only` throws outside Next's bundler, so this mock neutralizes the
// guard.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import { DataApiError } from "@/lib/data-api/repository";
import { isSerologySampleId } from "@/lib/serology-view";
import { getSerology } from "@/lib/serology-view/server";
import { isSurveillanceSampleId } from "@/lib/surveillance-view";
import { getSurveillance } from "@/lib/surveillance-view/server";

// Override the shared `next/navigation` mock so the real `notFound()` call is
// observable without Next's digest format.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));

import {
  loadCompoundSamplePage,
  loadCompoundSampleState,
} from "../compound-sample-page";
import { connectTimeout, maintenancePage } from "@/test-helpers/upstream-failures";

const dataApiUrl = "https://data.compound-sample-page.test";

const views = [
  {
    name: "Surveillance",
    resourcePath: "surveillance",
    isSampleId: isSurveillanceSampleId,
    lookup: getSurveillance,
  },
  {
    name: "Serology",
    resourcePath: "serology",
    isSampleId: isSerologySampleId,
    lookup: getSerology,
  },
] as const;

function upstreamError(status: number, message: string) {
  return HttpResponse.json({ message }, { status });
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject.");
}

beforeEach(() => {
  process.env.DATA_API_URL = dataApiUrl;
  setTestSession({ token: "test-token" });
});

afterEach(() => {
  delete process.env.DATA_API_URL;
});

describe.each(views)(
  "$name compound-sample page loader",
  ({ resourcePath, isSampleId, lookup }) => {
    it("maps an established not-found result to notFound()", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          HttpResponse.json({ response: { numFound: 0, docs: [] } }),
        ),
      );

      await expect(
        loadCompoundSamplePage("missing-sample", undefined, {
          source: "page",
          isSampleId,
          lookup,
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("maps a Data API 404 to notFound()", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(404, "Record not found upstream"),
        ),
      );

      await expect(
        loadCompoundSamplePage("sample-1", undefined, {
          source: "page",
          isSampleId,
          lookup,
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("preserves a Data API 401 instead of disguising it as not-found", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(401, "Session token expired upstream"),
        ),
      );

      const error = await rejection(
        loadCompoundSamplePage("sample-1", undefined, {
          source: "page",
          isSampleId,
          lookup,
        }),
      );

      expect(error).toBeInstanceOf(DataApiError);
      expect((error as DataApiError).status).toBe(401);
      expect((error as DataApiError).message).toBe(
        "Session token expired upstream",
      );
    });

    it("preserves a Data API 403 instead of disguising it as not-found", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(403, "Forbidden by upstream authorization policy"),
        ),
      );

      const error = await rejection(
        loadCompoundSamplePage("sample-1", undefined, {
          source: "page",
          isSampleId,
          lookup,
        }),
      );

      expect(error).toBeInstanceOf(DataApiError);
      expect((error as DataApiError).status).toBe(403);
      expect((error as DataApiError).message).toBe(
        "Forbidden by upstream authorization policy",
      );
    });

    it("preserves an upstream 5xx failure instead of disguising it as not-found", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(500, "Custom internal upstream failure"),
        ),
      );

      const error = await rejection(
        loadCompoundSamplePage("sample-1", undefined, {
          source: "page",
          isSampleId,
          lookup,
        }),
      );

      expect(error).toBeInstanceOf(DataApiError);
      expect((error as DataApiError).status).toBe(502);
      expect((error as DataApiError).message).toBe(
        "Custom internal upstream failure",
      );
    });

    /**
     * The two entry points get different strings (`encodeURIComponent(id)` and
     * the bare id) and must still resolve to the same identifier.
     */
    describe.each([
      ["a slash", "sample/1"],
      ["a space", "sample 1"],
      ["a literal percent", "sample%1"],
      ["a literal %2F", "sample%2F1"],
      ["an ampersand", "sample&1"],
      ["no escaped character at all", "000123"],
    ])(
      "both param sources resolve one identifier — %s",
      (_name, identifier) => {
        it(`resolves ${identifier} from either entry point`, async () => {
          const requested: string[] = [];
          server.use(
            http.get(`${dataApiUrl}/${resourcePath}/`, ({ request }) => {
              requested.push(new URL(request.url).search);
              return HttpResponse.json({
                response: {
                  numFound: 1,
                  docs: [{ id: "row-1", sample_identifier: identifier }],
                },
              });
            }),
          );

          const fromPage = await loadCompoundSamplePage(
            encodeURIComponent(identifier),
            undefined,
            { source: "page", isSampleId, lookup },
          );
          const fromMetadata = await loadCompoundSamplePage(
            identifier,
            undefined,
            { source: "metadata", isSampleId, lookup },
          );

          expect(fromPage.sampleId).toBe(identifier);
          expect(fromMetadata.sampleId).toBe(identifier);
          expect(new Set(requested).size).toBe(1);
        });
      },
    );
  },
);

describe.each(views)(
  "loadCompoundSampleState ($name, real lookup over MSW)",
  ({ resourcePath, isSampleId, lookup }) => {
    const options = { source: "page" as const, isSampleId, lookup };

    it("returns the condensed cause of a maintenance outage instead of throwing", async () => {
      server.use(http.get(`${dataApiUrl}/${resourcePath}/`, () => maintenancePage()));

      const loaded = await loadCompoundSampleState("sample-1", undefined, options);

      expect(loaded).toEqual({
        sampleId: "sample-1",
        unavailable: expect.stringMatching(
          /^The BV-BRC data service is unavailable \(HTTP 503 Service Unavailable: Site Maintenance/,
        ) as unknown,
      });
    });

    it("names the unreachable data service for a connect timeout", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () => {
          throw connectTimeout();
        }),
      );

      const loaded = await loadCompoundSampleState("sample-1", undefined, options);

      expect(loaded).toMatchObject({
        unavailable: expect.stringContaining(
          "did not respond (connection timed out after 10 s)",
        ) as unknown,
      });
    });

    it("keeps notFound() for a 404 and rethrows a 401", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(404, "Not found"),
        ),
      );
      await expect(
        loadCompoundSampleState("sample-1", undefined, options),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(401, "Unauthorized"),
        ),
      );
      const error = await rejection(
        loadCompoundSampleState("sample-1", undefined, options),
      );
      expect(error).toBeInstanceOf(DataApiError);
      expect((error as DataApiError).status).toBe(401);
    });
  },
);
