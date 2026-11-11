import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";
import { connectTimeout } from "@/test-helpers/upstream-failures";
import { fetchPhyloManifest, getSharedPhyloManifest } from "../phylo-manifest";

const defaultManifestUrl = "https://www.bv-brc.org/api/content/phyloxml_trees/manifest.json";
const manifestUrl = "https://example.test/phylo/manifest.json";

afterEach(() => {
  delete process.env.PHYLO_MANIFEST_URL;
  vi.useRealTimers();
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

describe("getSharedPhyloManifest", () => {
  const manifest = { "2955291": "Influenza A virus" };

  function advance(ms: number): void {
    vi.setSystemTime(Date.now() + ms);
  }

  /** Serves `respond` at the manifest URL; the returned function counts requests. */
  function serveManifest(respond: () => Response): () => number {
    let requests = 0;
    server.use(
      http.get(manifestUrl, () => {
        requests += 1;
        return respond();
      }),
    );
    return () => requests;
  }

  beforeEach(() => {
    process.env.PHYLO_MANIFEST_URL = manifestUrl;
  });

  it("retries a failed manifest (null) after 60 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let healthy = false;
    const requests = serveManifest(() =>
      healthy ? HttpResponse.json(manifest) : new HttpResponse(null, { status: 503 }),
    );

    expect(await getSharedPhyloManifest()).toBeNull();
    healthy = true;
    advance(59_000);
    expect(await getSharedPhyloManifest()).toBeNull();
    await settleBackgroundWork();
    expect(requests()).toBe(1);

    advance(2000);
    expect(await getSharedPhyloManifest()).toBeNull();
    await vi.waitFor(async () => {
      expect(await getSharedPhyloManifest()).toEqual({ trees: manifest });
    });
    expect(requests()).toBe(2);
  });

  it("holds a loaded manifest for an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveManifest(() => HttpResponse.json(manifest));

    const first = await getSharedPhyloManifest();
    expect(first).toEqual({ trees: manifest });
    advance(59 * 60_000);
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await settleBackgroundWork();
    expect(requests()).toBe(1);

    advance(2 * 60_000);
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await vi.waitFor(() => {
      expect(requests()).toBe(2);
    });
  });

  it("keeps a loaded manifest when a refresh fails, holding it for another hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let healthy = true;
    const requests = serveManifest(() =>
      healthy ? HttpResponse.json(manifest) : new HttpResponse(null, { status: 503 }),
    );

    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const first = await getSharedPhyloManifest();
    healthy = false;
    advance(61 * 60_000);
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("phylo-manifest: 503"));
    });
    // The cache stores the refresh's result in later microtasks.
    await settleBackgroundWork();
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await settleBackgroundWork();
    expect(requests()).toBe(2);

    advance(59 * 60_000);
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await settleBackgroundWork();
    expect(requests()).toBe(2);

    advance(2 * 60_000);
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await vi.waitFor(() => {
      expect(requests()).toBe(3);
    });
  });

  it.each([
    ["a network error", () => HttpResponse.error()],
    ["a 429", () => new HttpResponse(null, { status: 429 })],
    [
      "a truncated JSON body",
      () =>
        new HttpResponse('{"2955291":', {
          headers: { "Content-Type": "application/json" },
        }),
    ],
  ])("keeps a loaded manifest when a refresh gets %s", async (_label, failure) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let respond: () => Response = () => HttpResponse.json(manifest);
    const requests = serveManifest(() => respond());

    const first = await getSharedPhyloManifest();
    respond = failure;
    advance(61 * 60_000);
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await vi.waitFor(() => {
      expect(requests()).toBe(2);
    });
    await settleBackgroundWork();
    await expect(getSharedPhyloManifest()).resolves.toBe(first);
    await settleBackgroundWork();
    expect(requests()).toBe(2);
  });

  it.each([
    ["a 404", () => new HttpResponse(null, { status: 404 })],
    ["a 410", () => new HttpResponse(null, { status: 410 })],
    ["a JSON body that is not a manifest", () => HttpResponse.json({ notTrees: 1 })],
  ])(
    "replaces a loaded manifest with null when a refresh gets %s, rechecked after 60 s",
    async (_label, gone) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      let respond: () => Response = () => HttpResponse.json(manifest);
      const requests = serveManifest(() => respond());

      const first = await getSharedPhyloManifest();
      respond = gone;
      advance(61 * 60_000);
      await expect(getSharedPhyloManifest()).resolves.toBe(first);
      await vi.waitFor(async () => {
        expect(await getSharedPhyloManifest()).toBeNull();
      });

      advance(59_000);
      await expect(getSharedPhyloManifest()).resolves.toBeNull();
      await settleBackgroundWork();
      expect(requests()).toBe(2);

      respond = () => HttpResponse.json(manifest);
      advance(2000);
      await expect(getSharedPhyloManifest()).resolves.toBeNull();
      await vi.waitFor(async () => {
        expect(await getSharedPhyloManifest()).toEqual({ trees: manifest });
      });
      expect(requests()).toBe(3);
    },
  );

  it("keys the manifest by the URL configured when it is read", async () => {
    const requests = serveManifest(() => HttpResponse.json(manifest));
    server.use(
      http.get(defaultManifestUrl, () => HttpResponse.json({ "11320": "Influenza A virus" })),
    );

    expect(await getSharedPhyloManifest()).toEqual({ trees: manifest });
    delete process.env.PHYLO_MANIFEST_URL;
    expect(await getSharedPhyloManifest()).toEqual({
      trees: { "11320": "Influenza A virus" },
    });
    expect(requests()).toBe(1);
  });
});
