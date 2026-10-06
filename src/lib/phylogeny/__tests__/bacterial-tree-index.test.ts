import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";

vi.mock("server-only", () => ({}));

import {
  bacterialTreeFilename,
  resetBacterialTreeIndexForTests,
} from "../bacterial-tree-index";

const dictionaryUrl =
  "https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json";

beforeEach(() => {
  resetBacterialTreeIndexForTests();
  delete process.env.PHYLO_TREE_DICTIONARY_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bacterialTreeFilename", () => {
  it("looks up a taxon's tree and skips malformed entries", async () => {
    server.use(
      http.get(dictionaryUrl, () =>
        HttpResponse.json({
          "562": "Escherichia_561_genus.phyloxml",
          "2": null,
          abc: "ignored.phyloxml",
        }),
      ),
    );

    await expect(bacterialTreeFilename(562)).resolves.toBe(
      "Escherichia_561_genus.phyloxml",
    );
    await expect(bacterialTreeFilename(2)).resolves.toBeNull();
    await expect(bacterialTreeFilename(9999)).resolves.toBeNull();
  });

  it("downloads the dictionary once for concurrent and repeated lookups", async () => {
    let downloads = 0;
    server.use(
      http.get(dictionaryUrl, () => {
        downloads += 1;
        return HttpResponse.json({ "562": "e.phyloxml" });
      }),
    );

    await Promise.all([bacterialTreeFilename(562), bacterialTreeFilename(562)]);
    await bacterialTreeFilename(1);

    expect(downloads).toBe(1);
  });

  it("keeps the upstream status in the error and retries on the next lookup", async () => {
    server.use(
      http.get(
        dictionaryUrl,
        () =>
          new HttpResponse(null, {
            status: 503,
            statusText: "Service Unavailable",
          }),
      ),
    );
    // Substring match: whether statusText survives the interceptor is not
    // this module's concern, the status code is.
    await expect(bacterialTreeFilename(562)).rejects.toThrow(
      "tree dictionary: 503",
    );

    server.use(
      http.get(dictionaryUrl, () => HttpResponse.json({ "562": "e.phyloxml" })),
    );
    await expect(bacterialTreeFilename(562)).resolves.toBe("e.phyloxml");
  });

  it("serves the loaded dictionary while a stale one refreshes", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    server.use(
      http.get(dictionaryUrl, () =>
        HttpResponse.json({ "562": "old.phyloxml" }),
      ),
    );
    await expect(bacterialTreeFilename(562)).resolves.toBe("old.phyloxml");

    server.use(
      http.get(dictionaryUrl, () =>
        HttpResponse.json({ "562": "new.phyloxml" }),
      ),
    );
    now.mockReturnValue(25 * 60 * 60 * 1000);

    await expect(bacterialTreeFilename(562)).resolves.toBe("old.phyloxml");
    await vi.waitFor(async () => {
      await expect(bacterialTreeFilename(562)).resolves.toBe("new.phyloxml");
    });
  });

  it.each([
    ["an empty object", {}],
    ["an error body", { error: "temporarily unavailable" }],
    ["only malformed entries", { abc: "x.phyloxml", "2": null }],
  ])(
    "rejects a first load of %s and retries on the next lookup",
    async (_label, body) => {
      server.use(http.get(dictionaryUrl, () => HttpResponse.json(body)));
      await expect(bacterialTreeFilename(562)).rejects.toThrow(
        "tree dictionary has no valid entries",
      );

      server.use(
        http.get(dictionaryUrl, () =>
          HttpResponse.json({ "562": "e.phyloxml" }),
        ),
      );
      await expect(bacterialTreeFilename(562)).resolves.toBe("e.phyloxml");
    },
  );

  it("rejects non-object dictionary bodies", async () => {
    server.use(http.get(dictionaryUrl, () => HttpResponse.json([1, 2])));
    await expect(bacterialTreeFilename(562)).rejects.toThrow(
      "tree dictionary has an invalid shape",
    );
  });

  it("keeps the previous dictionary and refresh window when a refresh is empty", async () => {
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    let downloads = 0;
    server.use(
      http.get(dictionaryUrl, () => {
        downloads += 1;
        return HttpResponse.json({ "562": "old.phyloxml" });
      }),
    );
    await expect(bacterialTreeFilename(562)).resolves.toBe("old.phyloxml");

    let badRefreshes = 0;
    server.use(
      http.get(dictionaryUrl, () => {
        badRefreshes += 1;
        return HttpResponse.json({ error: "temporarily unavailable" });
      }),
    );
    now.mockReturnValue(25 * 60 * 60 * 1000);

    // Concurrent lookups share one refresh and one failure log.
    await Promise.all([
      bacterialTreeFilename(562),
      bacterialTreeFilename(562),
      bacterialTreeFilename(562),
    ]);
    // The failure is logged only after the in-flight refresh has settled.
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledTimes(1);
    });
    expect(badRefreshes).toBe(1);
    await expect(bacterialTreeFilename(562)).resolves.toBe("old.phyloxml");
    // Within the retry delay the failing upstream is left alone.
    await bacterialTreeFilename(562);
    expect(badRefreshes).toBe(1);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(downloads).toBe(1);

    // The window was not restarted, so once the delay passes it tries again.
    now.mockReturnValue(25 * 60 * 60 * 1000 + 5 * 60 * 1000);
    await expect(bacterialTreeFilename(562)).resolves.toBe("old.phyloxml");
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledTimes(2);
    });
    expect(badRefreshes).toBe(2);

    server.use(
      http.get(dictionaryUrl, () =>
        HttpResponse.json({ "562": "new.phyloxml" }),
      ),
    );
    now.mockReturnValue(25 * 60 * 60 * 1000 + 10 * 60 * 1000);
    await bacterialTreeFilename(562);
    await vi.waitFor(async () => {
      await expect(bacterialTreeFilename(562)).resolves.toBe("new.phyloxml");
    });
  });

  it("reads the dictionary from PHYLO_TREE_DICTIONARY_URL when set", async () => {
    const overrideUrl =
      "http://127.0.0.1:3100/api/e2e-mock/phylo-tree-dictionary";
    process.env.PHYLO_TREE_DICTIONARY_URL = overrideUrl;
    server.use(
      http.get(overrideUrl, () =>
        HttpResponse.json({ "234": "regression.xml" }),
      ),
    );

    await expect(bacterialTreeFilename(234)).resolves.toBe("regression.xml");
  });
});
