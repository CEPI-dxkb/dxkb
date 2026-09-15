// See src/lib/phylogeny/__tests__/dataset-store.test.ts: `server-only` throws
// unconditionally outside Next's bundler, so any test importing a module
// gated by it (this file imports the real `getSurveillance`/`getSerology`,
// which now pull in `@/lib/data-api/server-repository`) neutralizes the
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

// The shared setup mock for "next/navigation" (vitest.setup.ts) only covers
// client-side navigation hooks. Override it here with the same `notFound`
// convention used by the Surveillance/Serology page tests so this module's
// real `notFound()` call is observable without depending on Next's internal
// digest format.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));

import { loadCompoundSamplePage } from "../compound-sample-page";

/**
 * Full-stack tests for the shared page loader: real `getSurveillance` /
 * `getSerology` (session + ServerDataRepository) with the Data API itself
 * intercepted via MSW, so the errors exercised here are genuine
 * `DataApiError` instances produced by the real request/response mapping —
 * not hand-built stand-ins.
 */

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
        loadCompoundSamplePage("sample-1", undefined, { isSampleId, lookup }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("preserves a Data API 401 instead of disguising it as not-found", async () => {
      server.use(
        http.get(`${dataApiUrl}/${resourcePath}/`, () =>
          upstreamError(401, "Session token expired upstream"),
        ),
      );

      const error = await rejection(
        loadCompoundSamplePage("sample-1", undefined, { isSampleId, lookup }),
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
        loadCompoundSamplePage("sample-1", undefined, { isSampleId, lookup }),
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
        loadCompoundSamplePage("sample-1", undefined, { isSampleId, lookup }),
      );

      expect(error).toBeInstanceOf(DataApiError);
      expect((error as DataApiError).status).toBe(502);
      expect((error as DataApiError).message).toBe(
        "Custom internal upstream failure",
      );
    });
  },
);
