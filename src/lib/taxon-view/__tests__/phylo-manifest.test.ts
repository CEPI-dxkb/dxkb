// src/lib/taxon-view/__tests__/phylo-manifest.test.ts
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { connectTimeout } from "@/test-helpers/upstream-failures";
import { fetchPhyloManifest } from "../phylo-manifest";

const defaultManifestUrl = "https://www.bv-brc.org/api/content/phyloxml_trees/manifest.json";
const manifestUrl = "https://example.test/phylo/manifest.json";

afterEach(() => {
  delete process.env.PHYLO_MANIFEST_URL;
});

describe("fetchPhyloManifest", () => {
  it("uses the published manifest when the env var is unset", async () => {
    server.use(
      http.get(defaultManifestUrl, () =>
        HttpResponse.json({ "2955291": "Influenza A virus" }),
      ),
    );

    expect(await fetchPhyloManifest()).toEqual({
      trees: { "2955291": "Influenza A virus" },
    });
  });

  it("parses an already-wrapped manifest", async () => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
    server.use(
      http.get(manifestUrl, () =>
        HttpResponse.json({ trees: { "2955291": { url: "/trees/flu.xml" } } }),
      ),
    );
    const result = await fetchPhyloManifest();
    expect(result?.trees["2955291"]).toBeDefined();
  });

  it("normalizes the published flat manifest", async () => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
    server.use(
      http.get(manifestUrl, () =>
        HttpResponse.json({ "2955291": "Alphainfluenzavirus influenzae" }),
      ),
    );
    expect(await fetchPhyloManifest()).toEqual({
      trees: { "2955291": "Alphainfluenzavirus influenzae" },
    });
  });

  it("fails open (null) on a non-OK response", async () => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
    server.use(http.get(manifestUrl, () => new HttpResponse(null, { status: 503 })));
    expect(await fetchPhyloManifest()).toBeNull();
  });

  it("fails open (null) on a network error", async () => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
    server.use(http.get(manifestUrl, () => HttpResponse.error()));
    expect(await fetchPhyloManifest()).toBeNull();
  });

  it("logs which host did not respond rather than undici's bare \"fetch failed\"", async () => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
    server.use(
      http.get(manifestUrl, () => {
        throw connectTimeout();
      }),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await fetchPhyloManifest()).toBeNull();
    expect(logged).toHaveBeenCalledWith(
      "phylo-manifest (example.test): The BV-BRC phylogeny manifest did not respond (connection timed out after 10 s).",
    );
    logged.mockRestore();
  });

  it("fails open (null) when the body is the wrong shape", async () => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
    server.use(http.get(manifestUrl, () => HttpResponse.json({ notTrees: 1 })));
    expect(await fetchPhyloManifest()).toBeNull();
  });
});
