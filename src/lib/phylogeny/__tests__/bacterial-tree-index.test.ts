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
