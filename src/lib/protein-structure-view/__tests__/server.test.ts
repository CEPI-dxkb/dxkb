// See src/lib/phylogeny/__tests__/dataset-store.test.ts: `server-only` throws
// unconditionally outside Next's bundler, so any test importing a module
// gated by it (this one, transitively via `@/lib/data-api/server-repository`)
// neutralizes the guard.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { testCookieStore } from "@/test-helpers/api-route-helpers";
import { getProteinStructures } from "@/lib/protein-structure-view/server";

const originalDataApiUrl = process.env.DATA_API_URL;
const originalPublicDataApi = process.env.NEXT_PUBLIC_DATA_API;
const structureUrl = "https://data.example/protein_structure/";

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.example";
  delete process.env.NEXT_PUBLIC_DATA_API;
});

afterEach(() => {
  if (originalDataApiUrl === undefined) delete process.env.DATA_API_URL;
  else process.env.DATA_API_URL = originalDataApiUrl;
  if (originalPublicDataApi === undefined) delete process.env.NEXT_PUBLIC_DATA_API;
  else process.env.NEXT_PUBLIC_DATA_API = originalPublicDataApi;
});

describe("getProteinStructures", () => {
  it("queries metadata for AlphaFold accessions", async () => {
    server.use(
      http.get(structureUrl, () =>
        HttpResponse.json([
          { pdb_id: "AF-P12345-F1", title: "Predicted structure" },
        ]),
      ),
    );

    await expect(getProteinStructures(["AF-P12345-F1"])).resolves.toEqual([
      {
        accession: "AF-P12345-F1",
        metadata: {
          pdb_id: "AF-P12345-F1",
          title: "Predicted structure",
        },
      },
    ]);
  });

  it("keeps each metadata failure independent", async () => {
    let callCount = 0;
    server.use(
      http.get(structureUrl, () => {
        callCount += 1;
        return callCount === 1
          ? HttpResponse.json([{ pdb_id: "1ABC", title: "One" }])
          : new HttpResponse("backend unavailable", { status: 503 });
      }),
    );

    const result = await getProteinStructures(["1ABC", "2XYZ"]);
    expect(result[0]).toMatchObject({
      accession: "1ABC",
      metadata: { title: "One" },
    });
    expect(result[1]).toMatchObject({ accession: "2XYZ", metadata: null });
    expect(result[1]?.error).toBe(
      "The data service is temporarily unavailable. Please try again.",
    );
  });

  it("returns a generic per-accession error, without naming the env var, when the data API is not configured", async () => {
    delete process.env.DATA_API_URL;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await getProteinStructures(["1ABC", "2XYZ"]);

    const expectedError =
      "The protein structure service is not configured for this deployment.";
    expect(result).toEqual([
      { accession: "1ABC", metadata: null, error: expectedError },
      { accession: "2XYZ", metadata: null, error: expectedError },
    ]);
    expect(result.every((entry) => !entry.error?.includes("DATA_API_URL"))).toBe(
      true,
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it("propagates a readSession/cookies failure instead of reporting it as a configuration problem", async () => {
    // DATA_API_URL is set (see beforeEach), so this exercises a session
    // lookup failure with a genuinely valid configuration — the regression
    // this guards is the catch block in getProteinStructures relabeling any
    // failure from createServerDataRepository() as "not configured", which
    // would hide this error from both the caller and the operator log.
    const cookieStoreError = new Error(
      "Cookie store unavailable in this rendering mode",
    );
    testCookieStore.get.mockImplementationOnce(() => {
      throw cookieStoreError;
    });

    await expect(getProteinStructures(["1ABC"])).rejects.toThrow(
      cookieStoreError,
    );
  });
});
